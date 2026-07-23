-- Faza 2B — treatment plans (D19).
--
-- Replaces the local stub with the full SQL previously applied to the remote Supabase
-- project only (see docs/QA/Discrepancies.md D-01).
--
-- RBAC: owner/doctor write; assistant read; reception/accountant/technician no
-- (same matrix row as odontogram / plan terapije — PRD §3.2).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'treatment_plan_item_status') then
    create type public.treatment_plan_item_status as enum ('planned', 'in_progress', 'done', 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_plans_title_len_check check (char_length(title) between 1 and 255)
);

create index if not exists treatment_plans_clinic_id_idx on public.treatment_plans (clinic_id);
create index if not exists treatment_plans_patient_id_idx on public.treatment_plans (patient_id);
create index if not exists treatment_plans_clinic_id_patient_id_idx
  on public.treatment_plans (clinic_id, patient_id);

create table if not exists public.treatment_plan_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  treatment_plan_id uuid not null references public.treatment_plans (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,
  fdi_number smallint,
  status public.treatment_plan_item_status not null default 'planned',
  estimated_price_eur numeric(12, 2) not null default 0,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_plan_items_service_name_len_check check (char_length(service_name) between 1 and 255),
  constraint treatment_plan_items_fdi_check check (fdi_number is null or public.is_valid_fdi(fdi_number)),
  constraint treatment_plan_items_price_check check (estimated_price_eur >= 0)
);

create index if not exists treatment_plan_items_clinic_id_idx on public.treatment_plan_items (clinic_id);
create index if not exists treatment_plan_items_treatment_plan_id_idx
  on public.treatment_plan_items (treatment_plan_id);
create index if not exists treatment_plan_items_service_id_idx on public.treatment_plan_items (service_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.can_access_treatment_plan()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (select public.current_app_role()) in (
    'owner'::public.app_role, 'doctor'::public.app_role, 'assistant'::public.app_role
  );
$function$;

create or replace function public.can_write_treatment_plan()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'doctor'::public.app_role);
$function$;

create or replace function public.treatment_plan_items_enforce_clinic()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  plan_clinic uuid;
begin
  select clinic_id into plan_clinic from public.treatment_plans where id = new.treatment_plan_id;
  if plan_clinic is null then
    raise exception 'treatment plan not found';
  end if;
  if new.clinic_id is distinct from plan_clinic then
    raise exception 'clinic_id mismatch with treatment plan';
  end if;
  return new;
end;
$function$;

revoke all on function public.can_access_treatment_plan() from public, anon;
revoke all on function public.can_write_treatment_plan() from public, anon;
revoke all on function public.treatment_plan_items_enforce_clinic() from public, anon, authenticated;

grant execute on function public.can_access_treatment_plan() to authenticated, service_role;
grant execute on function public.can_write_treatment_plan() to authenticated, service_role;
grant execute on function public.treatment_plan_items_enforce_clinic() to service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists treatment_plans_set_updated_at on public.treatment_plans;
create trigger treatment_plans_set_updated_at
before update on public.treatment_plans
for each row
execute function public.set_updated_at();

drop trigger if exists treatment_plan_items_set_updated_at on public.treatment_plan_items;
create trigger treatment_plan_items_set_updated_at
before update on public.treatment_plan_items
for each row
execute function public.set_updated_at();

drop trigger if exists treatment_plan_items_enforce_clinic_trg on public.treatment_plan_items;
create trigger treatment_plan_items_enforce_clinic_trg
before insert or update of clinic_id, treatment_plan_id on public.treatment_plan_items
for each row
execute function public.treatment_plan_items_enforce_clinic();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.treatment_plans enable row level security;
alter table public.treatment_plan_items enable row level security;

drop policy if exists treatment_plans_select_clinical on public.treatment_plans;
create policy treatment_plans_select_clinical
on public.treatment_plans
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_treatment_plan());

drop policy if exists treatment_plans_insert_clinical on public.treatment_plans;
create policy treatment_plans_insert_clinical
on public.treatment_plans
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_treatment_plan());

drop policy if exists treatment_plans_update_clinical on public.treatment_plans;
create policy treatment_plans_update_clinical
on public.treatment_plans
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_treatment_plan())
with check (clinic_id = current_clinic_id() and can_write_treatment_plan());

drop policy if exists treatment_plans_delete_clinical on public.treatment_plans;
create policy treatment_plans_delete_clinical
on public.treatment_plans
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_treatment_plan());

-- NOTE: PERMISSIVE (not RESTRICTIVE) on this table — verified against remote pg_policies
-- dump; treatment_plans/treatment_plan_items/invoices/invoice_lines/payments/payment_plans/
-- payment_plan_installments are all PERMISSIVE for owner_mfa_aal2, unlike appointments/
-- appointment_waitlist/expenses/patients/etc which are RESTRICTIVE. Do not "fix" to
-- RESTRICTIVE — matching remote exactly is the P0.1 goal.
drop policy if exists treatment_plans_owner_mfa_aal2 on public.treatment_plans;
create policy treatment_plans_owner_mfa_aal2
on public.treatment_plans
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

drop policy if exists treatment_plan_items_select_clinical on public.treatment_plan_items;
create policy treatment_plan_items_select_clinical
on public.treatment_plan_items
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_treatment_plan());

drop policy if exists treatment_plan_items_insert_clinical on public.treatment_plan_items;
create policy treatment_plan_items_insert_clinical
on public.treatment_plan_items
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_treatment_plan());

drop policy if exists treatment_plan_items_update_clinical on public.treatment_plan_items;
create policy treatment_plan_items_update_clinical
on public.treatment_plan_items
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_treatment_plan())
with check (clinic_id = current_clinic_id() and can_write_treatment_plan());

drop policy if exists treatment_plan_items_delete_clinical on public.treatment_plan_items;
create policy treatment_plan_items_delete_clinical
on public.treatment_plan_items
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_treatment_plan());

-- PERMISSIVE per remote dump — see note above.
drop policy if exists treatment_plan_items_owner_mfa_aal2 on public.treatment_plan_items;
create policy treatment_plan_items_owner_mfa_aal2
on public.treatment_plan_items
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());
