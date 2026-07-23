-- Faza 2D — invoices, payments, payment plans, PDF paths (D29).
--
-- Replaces the local stub with the full SQL previously applied to the remote Supabase
-- project only (see docs/QA/Discrepancies.md D-01).
--
-- NOTE: `allocate_invoice_number(uuid)` is intentionally NOT (re)defined here — the
-- already-local 20260714040000_fix_allocate_invoice_number.sql creates it (via
-- CREATE OR REPLACE, which works whether or not a prior version exists) once
-- `invoice_number_counters`/`invoices` and `can_write_invoices()`/`owner_mfa_ok()` exist.
--
-- RBAC: owner + accountant only (PRD §3.2). Append-only lines/payments;
-- void instead of delete. Serial YYYY-#### unique per clinic.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('unpaid', 'partial', 'paid', 'void');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'other');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_plan_status') then
    create type public.payment_plan_status as enum ('active', 'completed', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_plan_installment_status') then
    create type public.payment_plan_installment_status as enum ('pending', 'paid', 'overdue', 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_number_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  series_year int not null,
  last_number int not null default 0,
  constraint invoice_number_counters_pkey primary key (clinic_id, series_year),
  constraint invoice_number_counters_series_year_check check (series_year between 2000 and 2100),
  constraint invoice_number_counters_last_number_check check (last_number >= 0)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id),
  location_id uuid references public.clinic_locations (id),
  doctor_id uuid references public.profiles (id),
  series_year int not null,
  series_number int not null,
  status public.invoice_status not null default 'unpaid',
  subtotal_amount numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null,
  currency text not null default 'EUR',
  notes text,
  issued_by uuid not null references public.profiles (id),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_reason text,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_series_year_check check (series_year between 2000 and 2100),
  constraint invoices_series_number_check check (series_number > 0),
  constraint invoices_subtotal_check check (subtotal_amount >= 0),
  constraint invoices_vat_check check (vat_amount >= 0),
  constraint invoices_total_check check (total_amount >= 0),
  constraint invoices_currency_check check (currency = 'EUR'),
  constraint invoices_clinic_series_unique unique (clinic_id, series_year, series_number),
  constraint invoices_void_state_check check (
    (status <> 'void' and voided_at is null) or (status = 'void' and voided_at is not null)
  )
);

create index if not exists invoices_clinic_id_issued_at_idx on public.invoices (clinic_id, issued_at desc);
create index if not exists invoices_clinic_id_patient_id_idx on public.invoices (clinic_id, patient_id);
create index if not exists invoices_clinic_id_status_idx on public.invoices (clinic_id, status);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  vat_rate numeric(5, 4) not null default 0,
  line_total numeric(12, 2) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_lines_quantity_check check (quantity > 0),
  constraint invoice_lines_unit_price_check check (unit_price >= 0),
  -- Fraction (0-1), NOT percentage like services.vat_rate (0-100) — app layer converts.
  constraint invoice_lines_vat_rate_check check (vat_rate >= 0 and vat_rate <= 1),
  constraint invoice_lines_line_total_check check (line_total >= 0)
);

create index if not exists invoice_lines_clinic_id_invoice_id_idx
  on public.invoice_lines (clinic_id, invoice_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id),
  amount numeric(12, 2) not null,
  method public.payment_method not null,
  paid_at timestamptz not null default now(),
  note text,
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint payments_amount_check check (amount > 0)
);

create index if not exists payments_clinic_id_invoice_id_idx on public.payments (clinic_id, invoice_id);
create index if not exists payments_clinic_id_paid_at_idx on public.payments (clinic_id, paid_at desc);

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id),
  patient_id uuid not null references public.patients (id),
  total_amount numeric(12, 2) not null,
  installment_count int not null,
  status public.payment_plan_status not null default 'active',
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_plans_total_amount_check check (total_amount > 0),
  constraint payment_plans_installment_count_check check (installment_count between 2 and 48)
);

create index if not exists payment_plans_clinic_id_invoice_id_idx
  on public.payment_plans (clinic_id, invoice_id);

create table if not exists public.payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  payment_plan_id uuid not null references public.payment_plans (id) on delete cascade,
  sequence_number int not null,
  due_date date not null,
  amount numeric(12, 2) not null,
  status public.payment_plan_installment_status not null default 'pending',
  paid_at timestamptz,
  payment_id uuid references public.payments (id),
  created_at timestamptz not null default now(),
  constraint payment_plan_installments_sequence_check check (sequence_number >= 1),
  constraint payment_plan_installments_amount_check check (amount > 0),
  constraint payment_plan_installments_sequence_unique unique (payment_plan_id, sequence_number)
);

create index if not exists payment_plan_installments_clinic_id_payment_plan_id_idx
  on public.payment_plan_installments (clinic_id, payment_plan_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.can_access_invoices()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'accountant'::public.app_role);
$function$;

create or replace function public.can_write_invoices()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'accountant'::public.app_role);
$function$;

create or replace function public.recompute_invoice_payment_status()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_status public.invoice_status;
begin
  select i.total_amount, i.status into v_total, v_status
  from public.invoices i where i.id = new.invoice_id for update;

  if v_status = 'void' then
    return new;
  end if;

  select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.invoice_id = new.invoice_id;

  if v_paid <= 0 then
    v_status := 'unpaid';
  elsif v_paid < v_total then
    v_status := 'partial';
  else
    v_status := 'paid';
  end if;

  update public.invoices set status = v_status, updated_at = now() where id = new.invoice_id;
  return new;
end;
$function$;

create or replace function public.list_patients_for_invoices()
returns table(id uuid, first_name text, last_name text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not (select public.can_access_invoices()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (select public.owner_mfa_ok()) then
    raise exception 'owner_mfa_required' using errcode = '42501';
  end if;

  return query
  select p.id, p.first_name, p.last_name from public.patients p
  where p.clinic_id = (select public.current_clinic_id()) and p.is_active = true
  order by p.last_name, p.first_name limit 500;
end;
$function$;

create or replace function public.get_patient_for_invoice(p_patient_id uuid)
returns table(id uuid, first_name text, last_name text, is_active boolean)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not (select public.can_write_invoices()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (select public.owner_mfa_ok()) then
    raise exception 'owner_mfa_required' using errcode = '42501';
  end if;

  return query
  select p.id, p.first_name, p.last_name, p.is_active from public.patients p
  where p.id = p_patient_id and p.clinic_id = (select public.current_clinic_id()) limit 1;
end;
$function$;

create or replace function public.get_invoice_patient_names(p_patient_ids uuid[])
returns table(id uuid, first_name text, last_name text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not (select public.can_access_invoices()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (select public.owner_mfa_ok()) then
    raise exception 'owner_mfa_required' using errcode = '42501';
  end if;

  return query
  select p.id, p.first_name, p.last_name from public.patients p
  where p.clinic_id = (select public.current_clinic_id()) and p.id = any (p_patient_ids);
end;
$function$;

revoke all on function public.can_access_invoices() from public, anon;
revoke all on function public.can_write_invoices() from public, anon;
revoke all on function public.recompute_invoice_payment_status() from public, anon, authenticated;
revoke all on function public.list_patients_for_invoices() from public, anon;
revoke all on function public.get_patient_for_invoice(uuid) from public, anon;
revoke all on function public.get_invoice_patient_names(uuid[]) from public, anon;

grant execute on function public.can_access_invoices() to authenticated, service_role;
grant execute on function public.can_write_invoices() to authenticated, service_role;
grant execute on function public.recompute_invoice_payment_status() to service_role;
grant execute on function public.list_patients_for_invoices() to authenticated, service_role;
grant execute on function public.get_patient_for_invoice(uuid) to authenticated, service_role;
grant execute on function public.get_invoice_patient_names(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

drop trigger if exists payment_plans_set_updated_at on public.payment_plans;
create trigger payment_plans_set_updated_at
before update on public.payment_plans
for each row
execute function public.set_updated_at();

drop trigger if exists payments_recompute_invoice_status on public.payments;
create trigger payments_recompute_invoice_status
after insert on public.payments
for each row
execute function public.recompute_invoice_payment_status();

-- ---------------------------------------------------------------------------
-- RLS (⚠️ PERMISSIVE, not RESTRICTIVE, owner_mfa_aal2 on this whole finance group —
-- verified against remote pg_policies dump; do not "fix" to RESTRICTIVE)
-- ---------------------------------------------------------------------------

alter table public.invoice_number_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.payment_plans enable row level security;
alter table public.payment_plan_installments enable row level security;

-- invoice_number_counters — no direct policies; only touched via allocate_invoice_number()
-- (SECURITY DEFINER). RLS enabled with zero policies = deny-all for authenticated/anon.

-- invoices — no DELETE policy; void via UPDATE only.
drop policy if exists invoices_select_finance on public.invoices;
create policy invoices_select_finance
on public.invoices
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_invoices());

drop policy if exists invoices_insert_finance on public.invoices;
create policy invoices_insert_finance
on public.invoices
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists invoices_update_finance on public.invoices;
create policy invoices_update_finance
on public.invoices
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_invoices())
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists invoices_owner_mfa_aal2 on public.invoices;
create policy invoices_owner_mfa_aal2
on public.invoices
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- invoice_lines — fully append-only: no UPDATE/DELETE policy at all.
drop policy if exists invoice_lines_select_finance on public.invoice_lines;
create policy invoice_lines_select_finance
on public.invoice_lines
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_invoices());

drop policy if exists invoice_lines_insert_finance on public.invoice_lines;
create policy invoice_lines_insert_finance
on public.invoice_lines
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists invoice_lines_owner_mfa_aal2 on public.invoice_lines;
create policy invoice_lines_owner_mfa_aal2
on public.invoice_lines
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- payments — fully append-only: no UPDATE/DELETE policy at all.
drop policy if exists payments_select_finance on public.payments;
create policy payments_select_finance
on public.payments
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_invoices());

drop policy if exists payments_insert_finance on public.payments;
create policy payments_insert_finance
on public.payments
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists payments_owner_mfa_aal2 on public.payments;
create policy payments_owner_mfa_aal2
on public.payments
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- payment_plans — no DELETE policy.
drop policy if exists payment_plans_select_finance on public.payment_plans;
create policy payment_plans_select_finance
on public.payment_plans
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_invoices());

drop policy if exists payment_plans_insert_finance on public.payment_plans;
create policy payment_plans_insert_finance
on public.payment_plans
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists payment_plans_update_finance on public.payment_plans;
create policy payment_plans_update_finance
on public.payment_plans
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_invoices())
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists payment_plans_owner_mfa_aal2 on public.payment_plans;
create policy payment_plans_owner_mfa_aal2
on public.payment_plans
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- payment_plan_installments — no DELETE policy.
drop policy if exists payment_plan_installments_select_finance on public.payment_plan_installments;
create policy payment_plan_installments_select_finance
on public.payment_plan_installments
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_invoices());

drop policy if exists payment_plan_installments_insert_finance on public.payment_plan_installments;
create policy payment_plan_installments_insert_finance
on public.payment_plan_installments
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists payment_plan_installments_update_finance on public.payment_plan_installments;
create policy payment_plan_installments_update_finance
on public.payment_plan_installments
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_invoices())
with check (clinic_id = current_clinic_id() and can_write_invoices());

drop policy if exists payment_plan_installments_owner_mfa_aal2 on public.payment_plan_installments;
create policy payment_plan_installments_owner_mfa_aal2
on public.payment_plan_installments
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- ---------------------------------------------------------------------------
-- Storage — invoice-scoped policies on the patient-files bucket (created in phase2a).
-- foldername = {clinic_id}/{patient_id}/invoices/{invoice_id}.pdf → foldername[3]='invoices'.
-- ---------------------------------------------------------------------------

drop policy if exists patient_files_invoices_select on storage.objects;
create policy patient_files_invoices_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and (storage.foldername(name))[3] = 'invoices'
  and can_access_invoices()
);

drop policy if exists patient_files_invoices_insert on storage.objects;
create policy patient_files_invoices_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and (storage.foldername(name))[3] = 'invoices'
  and can_write_invoices()
);

drop policy if exists patient_files_invoices_update on storage.objects;
create policy patient_files_invoices_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and (storage.foldername(name))[3] = 'invoices'
  and can_write_invoices()
)
with check (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[1] = (current_clinic_id())::text
  and (storage.foldername(name))[3] = 'invoices'
  and can_write_invoices()
);
