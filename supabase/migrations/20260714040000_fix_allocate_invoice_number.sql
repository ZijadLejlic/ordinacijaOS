-- Fix allocate_invoice_number: RETURNS TABLE (series_year, …) made
-- ON CONFLICT (clinic_id, series_year) ambiguous (Postgres 42702).
-- Use table alias + RETURN QUERY with local variables instead of OUT assignment.

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
  on conflict (clinic_id, series_year)
  do update set last_number = c.last_number + 1
  returning c.last_number into v_next;

  return query select v_year, v_next;
end;
$$;

revoke all on function public.allocate_invoice_number(uuid) from public, anon;
grant execute on function public.allocate_invoice_number(uuid) to authenticated;
