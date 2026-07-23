-- Faza 2E — expenses (rashodi) + dashboard payment stats RPC (D29).
--
-- Replaces the local stub with the full SQL previously applied to the remote Supabase
-- project only (see docs/QA/Discrepancies.md D-01).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_category') then
    create type public.expense_category as enum (
      'supplies', 'lab', 'rent', 'utilities', 'salaries', 'equipment', 'marketing', 'other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  category public.expense_category not null default 'other',
  description text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'EUR',
  expense_date date not null default (timezone('Europe/Sarajevo', now()))::date,
  vendor text,
  notes text,
  recorded_by uuid not null references public.profiles (id),
  voided_at timestamptz,
  voided_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_description_len_check check (char_length(description) between 1 and 500),
  constraint expenses_amount_check check (amount > 0),
  constraint expenses_currency_check check (currency = 'EUR'),
  constraint expenses_vendor_len_check check (vendor is null or char_length(vendor) <= 200),
  constraint expenses_notes_len_check check (notes is null or char_length(notes) <= 2000),
  constraint expenses_voided_reason_len_check check (
    voided_reason is null or char_length(voided_reason) <= 500
  )
);

create index if not exists expenses_clinic_id_category_idx
  on public.expenses (clinic_id, category) where voided_at is null;
create index if not exists expenses_clinic_id_expense_date_idx
  on public.expenses (clinic_id, expense_date desc);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.can_access_expenses()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'accountant'::public.app_role);
$function$;

create or replace function public.can_write_expenses()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select (select public.current_app_role()) in ('owner'::public.app_role, 'accountant'::public.app_role);
$function$;

create or replace function public.dashboard_payment_stats(
  p_today_start timestamptz, p_today_end timestamptz,
  p_month_start timestamptz, p_month_end timestamptz, p_trend_start timestamptz
)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_clinic_id uuid := public.current_clinic_id();
  v_role public.app_role := public.current_app_role();
  v_uid uuid := auth.uid();
  v_tz text := coalesce((select timezone from public.clinics where id = v_clinic_id), 'Europe/Sarajevo');
  v_peer boolean := coalesce(
    ((select settings_json ->> 'doctors_see_peer_amounts' from public.clinics where id = v_clinic_id)::boolean),
    false
  );
  v_today numeric := 0;
  v_month numeric := 0;
  v_by_doctor jsonb := '[]'::jsonb;
  v_trend jsonb := '[]'::jsonb;
  v_finance boolean;
begin
  if v_clinic_id is null or v_uid is null then
    return jsonb_build_object('today_revenue', 0, 'month_revenue', 0, 'by_doctor', '[]'::jsonb, 'trend', '[]'::jsonb);
  end if;

  v_finance := v_role in ('owner'::public.app_role, 'accountant'::public.app_role, 'doctor'::public.app_role);
  if not v_finance then
    return jsonb_build_object('today_revenue', 0, 'month_revenue', 0, 'by_doctor', '[]'::jsonb, 'trend', '[]'::jsonb);
  end if;

  select coalesce(sum(p.amount), 0) into v_today
  from public.payments p join public.invoices i on i.id = p.invoice_id
  where p.clinic_id = v_clinic_id and i.status <> 'void'
    and p.paid_at >= p_today_start and p.paid_at < p_today_end
    and (v_role in ('owner'::public.app_role, 'accountant'::public.app_role)
         or i.doctor_id = v_uid or (v_role = 'doctor'::public.app_role and v_peer));

  select coalesce(sum(p.amount), 0) into v_month
  from public.payments p join public.invoices i on i.id = p.invoice_id
  where p.clinic_id = v_clinic_id and i.status <> 'void'
    and p.paid_at >= p_month_start and p.paid_at < p_month_end
    and (v_role in ('owner'::public.app_role, 'accountant'::public.app_role)
         or i.doctor_id = v_uid or (v_role = 'doctor'::public.app_role and v_peer));

  if v_role in ('owner'::public.app_role, 'accountant'::public.app_role)
     or (v_role = 'doctor'::public.app_role and v_peer) then
    select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.amount desc), '[]'::jsonb) into v_by_doctor
    from (
      select coalesce(i.doctor_id::text, '__none__') as doctor_id,
        coalesce(pr.full_name, '—') as doctor_name, round(sum(p.amount)::numeric, 2) as amount
      from public.payments p join public.invoices i on i.id = p.invoice_id
      left join public.profiles pr on pr.id = i.doctor_id
      where p.clinic_id = v_clinic_id and i.status <> 'void'
        and p.paid_at >= p_month_start and p.paid_at < p_month_end
      group by i.doctor_id, pr.full_name
    ) t;
  elsif v_role = 'doctor'::public.app_role then
    v_by_doctor := jsonb_build_array(jsonb_build_object(
      'doctor_id', v_uid::text,
      'doctor_name', coalesce((select full_name from public.profiles where id = v_uid), '—'),
      'amount', round(v_month::numeric, 2)
    ));
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.month), '[]'::jsonb) into v_trend
  from (
    select to_char(timezone(v_tz, p.paid_at), 'YYYY-MM') as month, round(sum(p.amount)::numeric, 2) as revenue
    from public.payments p join public.invoices i on i.id = p.invoice_id
    where p.clinic_id = v_clinic_id and i.status <> 'void' and p.paid_at >= p_trend_start
      and (v_role in ('owner'::public.app_role, 'accountant'::public.app_role)
           or i.doctor_id = v_uid or (v_role = 'doctor'::public.app_role and v_peer))
    group by 1
  ) t;

  return jsonb_build_object(
    'today_revenue', round(v_today::numeric, 2), 'month_revenue', round(v_month::numeric, 2),
    'by_doctor', coalesce(v_by_doctor, '[]'::jsonb), 'trend', coalesce(v_trend, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.can_access_expenses() from public, anon;
revoke all on function public.can_write_expenses() from public, anon;
revoke all on function public.dashboard_payment_stats(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;

grant execute on function public.can_access_expenses() to authenticated, service_role;
grant execute on function public.can_write_expenses() to authenticated, service_role;
grant execute on function public.dashboard_payment_stats(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — no DELETE policy; void via UPDATE. RESTRICTIVE owner_mfa_aal2 (unlike the
-- invoices/payments group, this one IS restrictive per remote dump).
-- ---------------------------------------------------------------------------

alter table public.expenses enable row level security;

drop policy if exists expenses_select_finance on public.expenses;
create policy expenses_select_finance
on public.expenses
for select
to authenticated
using (clinic_id = current_clinic_id() and can_access_expenses());

drop policy if exists expenses_insert_finance on public.expenses;
create policy expenses_insert_finance
on public.expenses
for insert
to authenticated
with check (clinic_id = current_clinic_id() and can_write_expenses());

drop policy if exists expenses_update_finance on public.expenses;
create policy expenses_update_finance
on public.expenses
for update
to authenticated
using (clinic_id = current_clinic_id() and can_write_expenses())
with check (clinic_id = current_clinic_id() and can_write_expenses());

drop policy if exists expenses_owner_mfa_aal2 on public.expenses;
create policy expenses_owner_mfa_aal2
on public.expenses
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());
