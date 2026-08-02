-- Cheap nav-badge count: quantity <= low_stock_threshold in SQL (no full-row fetch).
-- SECURITY INVOKER so inventory_items RLS still applies.

create or replace function public.count_low_stock_items(p_clinic_id uuid)
returns integer
language sql
stable
security invoker
set search_path to 'public'
as $$
  select count(*)::integer
  from public.inventory_items
  where clinic_id = p_clinic_id
    and is_active = true
    and quantity <= low_stock_threshold;
$$;

revoke all on function public.count_low_stock_items(uuid) from public, anon;
grant execute on function public.count_low_stock_items(uuid) to authenticated;
