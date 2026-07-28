-- P2.1 / D-14: prior fix (20260714040000) still left ON CONFLICT (clinic_id, series_year)
-- ambiguous under RETURNS TABLE (series_year, series_number) — Postgres 42702.
-- Live probe (FIN-DB-001 / FIN-INT-001) proved every same-clinic allocate hit 42702
-- and fell through to the temporary service-role fallback in allocate-number.ts.
-- Use the named PK constraint so the conflict target does not resolve to the
-- PL/pgSQL OUT variable of the same name.

create or replace function public.allocate_invoice_number(p_clinic_id uuid)
returns table (series_year int, series_number int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_year int := extract(year from timezone('Europe/Sarajevo', now()))::int;
  v_next int;
begin
  if p_clinic_id is distinct from (select public.current_clinic_id()) then
    raise exception 'forbidden_clinic' using errcode = '42501';
  end if;
  if not (select public.can_write_invoices()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (select public.owner_mfa_ok()) then
    raise exception 'owner_mfa_required' using errcode = '42501';
  end if;

  insert into public.invoice_number_counters as c (clinic_id, series_year, last_number)
  values (p_clinic_id, v_year, 1)
  on conflict on constraint invoice_number_counters_pkey
  do update set last_number = c.last_number + 1
  returning c.last_number into v_next;

  return query select v_year, v_next;
end;
$$;

revoke all on function public.allocate_invoice_number(uuid) from public, anon;
grant execute on function public.allocate_invoice_number(uuid) to authenticated;
