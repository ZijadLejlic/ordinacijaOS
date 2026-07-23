-- Faza 2A — clinical core (services, patients, allergies, documents, images, odontogram).
--
-- Replaces the local stub with the full SQL that was previously applied to the remote
-- Supabase project only (see docs/QA/Discrepancies.md D-01). See docs/DB-OrdinacijaOS.md §5
-- and docs/Tech-OrdinacijaOS.md §6 for the table summary and storage/bucket details.
--
-- NOTE: `services_insert_owner` created below is intentionally dropped and replaced by
-- `services_insert_import` in the already-local 20260713280000_phase2h_csv_import.sql
-- (which also defines `can_import_services()` — do NOT redefine it here).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'allergy_severity') then
    create type public.allergy_severity as enum ('mild', 'moderate', 'severe', 'unknown');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tooth_status') then
    create type public.tooth_status as enum (
      'healthy', 'caries', 'filled', 'crown', 'missing', 'implant', 'root_canal', 'bridge', 'other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  location_id uuid references public.clinic_locations (id) on delete set null,
  name text not null,
  code text,
  duration_minutes int not null default 30,
  price_eur numeric(12, 2) not null,
  vat_rate numeric(5, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_name_len_check check (char_length(name) between 1 and 200),
  constraint services_duration_check check (duration_minutes > 0 and duration_minutes <= 480),
  constraint services_price_check check (price_eur >= 0),
  constraint services_vat_rate_check check (vat_rate >= 0 and vat_rate <= 100)
);

create index if not exists services_clinic_id_idx on public.services (clinic_id);
create index if not exists services_clinic_id_is_active_idx on public.services (clinic_id, is_active);
create index if not exists services_location_id_idx on public.services (location_id) where location_id is not null;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  phone text,
  email text,
  address text,
  notes text,
  medical_history text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_control_at date,
  constraint patients_first_name_len_check check (char_length(first_name) between 1 and 100),
  constraint patients_last_name_len_check check (char_length(last_name) between 1 and 100)
);

create index if not exists patients_clinic_id_idx on public.patients (clinic_id);
create index if not exists patients_clinic_id_is_active_idx on public.patients (clinic_id, is_active);
create index if not exists patients_clinic_id_name_idx
  on public.patients (clinic_id, lower(last_name), lower(first_name));
create index if not exists patients_clinic_id_next_control_idx
  on public.patients (clinic_id, next_control_at) where next_control_at is not null;
create index if not exists patients_clinic_id_phone_idx
  on public.patients (clinic_id, phone) where phone is not null;

create table if not exists public.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  allergen text not null,
  severity public.allergy_severity not null default 'unknown',
  notes text,
  created_at timestamptz not null default now(),
  constraint patient_allergies_allergen_len_check check (char_length(allergen) between 1 and 200)
);

create index if not exists patient_allergies_clinic_id_idx on public.patient_allergies (clinic_id);
create index if not exists patient_allergies_patient_id_idx on public.patient_allergies (patient_id);

create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patient_documents_title_len_check check (char_length(title) between 1 and 200),
  constraint patient_documents_size_check check (size_bytes >= 0)
);

create index if not exists patient_documents_clinic_id_idx on public.patient_documents (clinic_id);
create index if not exists patient_documents_patient_id_idx on public.patient_documents (patient_id);

create table if not exists public.patient_images (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  mime_type text not null default 'image/webp',
  size_bytes bigint not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patient_images_title_len_check check (char_length(title) between 1 and 200),
  constraint patient_images_size_check check (size_bytes >= 0)
);

create index if not exists patient_images_clinic_id_idx on public.patient_images (clinic_id);
create index if not exists patient_images_patient_id_idx on public.patient_images (patient_id);

create table if not exists public.odontogram_teeth (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  fdi_number smallint not null,
  status public.tooth_status not null default 'healthy',
  surfaces_json jsonb not null default '{}'::jsonb,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint odontogram_teeth_patient_fdi_unique unique (patient_id, fdi_number)
);

create index if not exists odontogram_teeth_clinic_id_idx on public.odontogram_teeth (clinic_id);
create index if not exists odontogram_teeth_patient_id_idx on public.odontogram_teeth (patient_id);

create table if not exists public.odontogram_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  fdi_number smallint not null,
  event_type text not null,
  status_before public.tooth_status,
  status_after public.tooth_status,
  note text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint odontogram_events_event_type_len_check check (char_length(event_type) between 1 and 100)
);

create index if not exists odontogram_events_clinic_id_idx on public.odontogram_events (clinic_id);
create index if not exists odontogram_events_patient_id_idx on public.odontogram_events (patient_id);
create index if not exists odontogram_events_patient_id_created_at_idx
  on public.odontogram_events (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_fdi(p_fdi smallint)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select p_fdi between 11 and 48
    and (p_fdi / 10) between 1 and 4
    and (p_fdi % 10) between 1 and 8;
$function$;

create or replace function public.can_access_patients()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (select public.current_app_role()) in (
    'owner'::public.app_role, 'doctor'::public.app_role,
    'assistant'::public.app_role, 'reception'::public.app_role
  );
$function$;

create or replace function public.can_write_patients()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (select public.current_app_role()) in (
    'owner'::public.app_role, 'doctor'::public.app_role,
    'assistant'::public.app_role, 'reception'::public.app_role
  );
$function$;

create or replace function public.can_write_odontogram()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'doctor'::public.app_role);
$function$;

create or replace function public.can_write_services()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (select public.is_clinic_owner());
$function$;
-- can_import_services already defined in 20260713280000_phase2h_csv_import.sql — do NOT redefine.

-- Now that odontogram_teeth/odontogram_events exist, add the FDI CHECK constraints
-- (deferred until after is_valid_fdi() exists).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'odontogram_teeth_fdi_check' and conrelid = 'public.odontogram_teeth'::regclass
  ) then
    alter table public.odontogram_teeth
      add constraint odontogram_teeth_fdi_check check (public.is_valid_fdi(fdi_number));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'odontogram_events_fdi_check' and conrelid = 'public.odontogram_events'::regclass
  ) then
    alter table public.odontogram_events
      add constraint odontogram_events_fdi_check check (public.is_valid_fdi(fdi_number));
  end if;
end $$;

revoke all on function public.is_valid_fdi(smallint) from public, anon;
revoke all on function public.can_access_patients() from public, anon;
revoke all on function public.can_write_patients() from public, anon;
revoke all on function public.can_write_odontogram() from public, anon;
revoke all on function public.can_write_services() from public, anon;

grant execute on function public.is_valid_fdi(smallint) to authenticated, service_role;
grant execute on function public.can_access_patients() to authenticated, service_role;
grant execute on function public.can_write_patients() to authenticated, service_role;
grant execute on function public.can_write_odontogram() to authenticated, service_role;
grant execute on function public.can_write_services() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

drop trigger if exists odontogram_teeth_set_updated_at on public.odontogram_teeth;
create trigger odontogram_teeth_set_updated_at
before update on public.odontogram_teeth
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.services enable row level security;
alter table public.patients enable row level security;
alter table public.patient_allergies enable row level security;
alter table public.patient_documents enable row level security;
alter table public.patient_images enable row level security;
alter table public.odontogram_teeth enable row level security;
alter table public.odontogram_events enable row level security;

-- services
drop policy if exists services_select_member on public.services;
create policy services_select_member
on public.services
for select
to authenticated
using (clinic_id = current_clinic_id());

-- Dropped + replaced by services_insert_import in 20260713280000_phase2h_csv_import.sql.
drop policy if exists services_insert_owner on public.services;
create policy services_insert_owner
on public.services
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_services());

drop policy if exists services_update_owner on public.services;
create policy services_update_owner
on public.services
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_services())
with check (clinic_id = current_clinic_id() and can_write_services());

drop policy if exists services_delete_owner on public.services;
create policy services_delete_owner
on public.services
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_services());

drop policy if exists services_owner_mfa_aal2 on public.services;
create policy services_owner_mfa_aal2
on public.services
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- patients
drop policy if exists patients_select_clinical on public.patients;
create policy patients_select_clinical
on public.patients
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_patients());

drop policy if exists patients_insert_clinical on public.patients;
create policy patients_insert_clinical
on public.patients
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patients_update_clinical on public.patients;
create policy patients_update_clinical
on public.patients
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_patients())
with check (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patients_delete_owner on public.patients;
create policy patients_delete_owner
on public.patients
for delete
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner());

drop policy if exists patients_owner_mfa_aal2 on public.patients;
create policy patients_owner_mfa_aal2
on public.patients
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- patient_allergies (select/insert/update/delete all clinical)
drop policy if exists patient_allergies_select_clinical on public.patient_allergies;
create policy patient_allergies_select_clinical
on public.patient_allergies
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_patients());

drop policy if exists patient_allergies_insert_clinical on public.patient_allergies;
create policy patient_allergies_insert_clinical
on public.patient_allergies
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_allergies_update_clinical on public.patient_allergies;
create policy patient_allergies_update_clinical
on public.patient_allergies
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_patients())
with check (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_allergies_delete_clinical on public.patient_allergies;
create policy patient_allergies_delete_clinical
on public.patient_allergies
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_allergies_owner_mfa_aal2 on public.patient_allergies;
create policy patient_allergies_owner_mfa_aal2
on public.patient_allergies
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- patient_documents (select/insert/delete only — no UPDATE, files are immutable once uploaded)
drop policy if exists patient_documents_select_clinical on public.patient_documents;
create policy patient_documents_select_clinical
on public.patient_documents
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_patients());

drop policy if exists patient_documents_insert_clinical on public.patient_documents;
create policy patient_documents_insert_clinical
on public.patient_documents
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_documents_delete_clinical on public.patient_documents;
create policy patient_documents_delete_clinical
on public.patient_documents
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_documents_owner_mfa_aal2 on public.patient_documents;
create policy patient_documents_owner_mfa_aal2
on public.patient_documents
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- patient_images (select/insert/delete only — same shape as patient_documents)
drop policy if exists patient_images_select_clinical on public.patient_images;
create policy patient_images_select_clinical
on public.patient_images
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_patients());

drop policy if exists patient_images_insert_clinical on public.patient_images;
create policy patient_images_insert_clinical
on public.patient_images
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_images_delete_clinical on public.patient_images;
create policy patient_images_delete_clinical
on public.patient_images
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_patients());

drop policy if exists patient_images_owner_mfa_aal2 on public.patient_images;
create policy patient_images_owner_mfa_aal2
on public.patient_images
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- odontogram_teeth — SELECT gate is owner/doctor/assistant only (reception excluded),
-- different from can_access_patients().
drop policy if exists odontogram_teeth_select_clinical on public.odontogram_teeth;
create policy odontogram_teeth_select_clinical
on public.odontogram_teeth
for select
to authenticated
using (
  clinic_id = current_clinic_id()
  and current_app_role() = any (array['owner', 'doctor', 'assistant']::public.app_role[])
);

drop policy if exists odontogram_teeth_insert_clinical on public.odontogram_teeth;
create policy odontogram_teeth_insert_clinical
on public.odontogram_teeth
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_odontogram());

drop policy if exists odontogram_teeth_update_clinical on public.odontogram_teeth;
create policy odontogram_teeth_update_clinical
on public.odontogram_teeth
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_odontogram())
with check (clinic_id = current_clinic_id() and can_write_odontogram());

drop policy if exists odontogram_teeth_delete_clinical on public.odontogram_teeth;
create policy odontogram_teeth_delete_clinical
on public.odontogram_teeth
for delete
to authenticated
using (clinic_id = current_clinic_id() and can_write_odontogram());

drop policy if exists odontogram_teeth_owner_mfa_aal2 on public.odontogram_teeth;
create policy odontogram_teeth_owner_mfa_aal2
on public.odontogram_teeth
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- odontogram_events — append-only audit trail: SELECT + INSERT only, same SELECT gate as teeth.
drop policy if exists odontogram_events_select_clinical on public.odontogram_events;
create policy odontogram_events_select_clinical
on public.odontogram_events
for select
to authenticated
using (
  clinic_id = current_clinic_id()
  and current_app_role() = any (array['owner', 'doctor', 'assistant']::public.app_role[])
);

drop policy if exists odontogram_events_insert_clinical on public.odontogram_events;
create policy odontogram_events_insert_clinical
on public.odontogram_events
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_odontogram());

drop policy if exists odontogram_events_owner_mfa_aal2 on public.odontogram_events;
create policy odontogram_events_owner_mfa_aal2
on public.odontogram_events
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- ---------------------------------------------------------------------------
-- Storage — patient-files bucket (private) + base clinic/patient-scoped policies.
-- Path convention: {clinic_id}/{patient_id}/documents|images/... and
-- {clinic_id}/{patient_id}/invoices/... (added by phase2d, foldername[3]='invoices').
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-files',
  'patient-files',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists patient_files_select on storage.objects;
create policy patient_files_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and can_access_patients()
);

drop policy if exists patient_files_insert on storage.objects;
create policy patient_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and can_write_patients()
);

drop policy if exists patient_files_update on storage.objects;
create policy patient_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and can_write_patients()
)
with check (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and can_write_patients()
);

drop policy if exists patient_files_delete on storage.objects;
create policy patient_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and can_write_patients()
);
