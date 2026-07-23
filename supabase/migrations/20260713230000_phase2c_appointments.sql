-- Faza 2C — appointments + waitlist (D14 / D15 / D25).
--
-- Replaces the local stub with the full SQL previously applied to the remote Supabase
-- project only (see docs/QA/Discrepancies.md D-01).
--
-- RBAC: calendar owner/doctor/assistant/reception; doctor scoped to self;
-- waitlist owner/reception only (PRD §3.2).

-- ---------------------------------------------------------------------------
-- Extension (needed for the EXCLUDE constraint below)
-- ---------------------------------------------------------------------------

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum (
      'pending_confirmation', 'confirmed', 'completed', 'cancelled', 'no_show'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'waitlist_status') then
    create type public.waitlist_status as enum ('waiting', 'offered', 'booked', 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id),
  patient_id uuid not null references public.patients (id),
  location_id uuid references public.clinic_locations (id),
  service_id uuid references public.services (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_ends_after_starts_check check (ends_at > starts_at),
  constraint appointments_no_doctor_overlap exclude using gist (
    clinic_id with =,
    doctor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);

create index if not exists appointments_clinic_id_doctor_id_starts_at_idx
  on public.appointments (clinic_id, doctor_id, starts_at);
create index if not exists appointments_clinic_id_patient_id_idx
  on public.appointments (clinic_id, patient_id);
create index if not exists appointments_clinic_id_starts_at_idx
  on public.appointments (clinic_id, starts_at);

create table if not exists public.appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id),
  doctor_id uuid references public.profiles (id),
  service_id uuid references public.services (id),
  location_id uuid references public.clinic_locations (id),
  preferred_from date,
  preferred_to date,
  notes text,
  status public.waitlist_status not null default 'waiting',
  priority int not null default 0,
  offered_appointment_id uuid references public.appointments (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_waitlist_date_range_check check (
    preferred_from is null or preferred_to is null or preferred_to >= preferred_from
  )
);

create index if not exists appointment_waitlist_clinic_id_patient_id_idx
  on public.appointment_waitlist (clinic_id, patient_id);
create index if not exists appointment_waitlist_clinic_id_status_created_at_idx
  on public.appointment_waitlist (clinic_id, status, created_at);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.can_access_appointments()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in (
    'owner'::public.app_role, 'doctor'::public.app_role,
    'assistant'::public.app_role, 'reception'::public.app_role
  );
$function$;

create or replace function public.can_write_appointments()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in (
    'owner'::public.app_role, 'doctor'::public.app_role,
    'assistant'::public.app_role, 'reception'::public.app_role
  );
$function$;

create or replace function public.can_manage_all_appointment_doctors()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in (
    'owner'::public.app_role, 'assistant'::public.app_role, 'reception'::public.app_role
  );
$function$;

create or replace function public.can_access_waitlist()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'reception'::public.app_role);
$function$;

create or replace function public.can_write_waitlist()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'reception'::public.app_role);
$function$;

revoke all on function public.can_access_appointments() from public, anon;
revoke all on function public.can_write_appointments() from public, anon;
revoke all on function public.can_manage_all_appointment_doctors() from public, anon;
revoke all on function public.can_access_waitlist() from public, anon;
revoke all on function public.can_write_waitlist() from public, anon;

grant execute on function public.can_access_appointments() to authenticated, service_role;
grant execute on function public.can_write_appointments() to authenticated, service_role;
grant execute on function public.can_manage_all_appointment_doctors() to authenticated, service_role;
grant execute on function public.can_access_waitlist() to authenticated, service_role;
grant execute on function public.can_write_waitlist() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

drop trigger if exists appointment_waitlist_set_updated_at on public.appointment_waitlist;
create trigger appointment_waitlist_set_updated_at
before update on public.appointment_waitlist
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.appointments enable row level security;
alter table public.appointment_waitlist enable row level security;

-- appointments — doctors are scoped to their own rows unless they can manage all doctors.
drop policy if exists appointments_select_clinical on public.appointments;
create policy appointments_select_clinical
on public.appointments
for select
to authenticated
using (
  clinic_id = current_clinic_id()
  and can_access_appointments()
  and (can_manage_all_appointment_doctors() or doctor_id = auth.uid())
);

drop policy if exists appointments_insert_clinical on public.appointments;
create policy appointments_insert_clinical
on public.appointments
for insert
to authenticated
with check (
  clinic_id = current_clinic_id()
  and can_write_appointments()
  and (can_manage_all_appointment_doctors() or doctor_id = auth.uid())
);

drop policy if exists appointments_update_clinical on public.appointments;
create policy appointments_update_clinical
on public.appointments
for update
to authenticated
using (
  clinic_id = current_clinic_id()
  and can_write_appointments()
  and (can_manage_all_appointment_doctors() or doctor_id = auth.uid())
)
with check (
  clinic_id = current_clinic_id()
  and can_write_appointments()
  and (can_manage_all_appointment_doctors() or doctor_id = auth.uid())
);

drop policy if exists appointments_delete_clinical on public.appointments;
create policy appointments_delete_clinical
on public.appointments
for delete
to authenticated
using (
  clinic_id = current_clinic_id()
  and can_write_appointments()
  and (can_manage_all_appointment_doctors() or doctor_id = auth.uid())
);

drop policy if exists appointments_owner_mfa_aal2 on public.appointments;
create policy appointments_owner_mfa_aal2
on public.appointments
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- appointment_waitlist
drop policy if exists appointment_waitlist_select_clinical on public.appointment_waitlist;
create policy appointment_waitlist_select_clinical
on public.appointment_waitlist
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_waitlist());

drop policy if exists appointment_waitlist_insert_clinical on public.appointment_waitlist;
create policy appointment_waitlist_insert_clinical
on public.appointment_waitlist
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_waitlist());

drop policy if exists appointment_waitlist_update_clinical on public.appointment_waitlist;
create policy appointment_waitlist_update_clinical
on public.appointment_waitlist
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_waitlist())
with check (clinic_id = current_clinic_id() and can_write_waitlist());

drop policy if exists appointment_waitlist_delete_clinical on public.appointment_waitlist;
create policy appointment_waitlist_delete_clinical
on public.appointment_waitlist
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_waitlist());

drop policy if exists appointment_waitlist_owner_mfa_aal2 on public.appointment_waitlist;
create policy appointment_waitlist_owner_mfa_aal2
on public.appointment_waitlist
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());
