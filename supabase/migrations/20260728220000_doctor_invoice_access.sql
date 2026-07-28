-- D53: Doctors may access/create invoices, payments, PDF (same write path as accountant).
-- Expenses / Excel and owner-only legal settings stay unchanged (app RBAC).

create or replace function public.can_access_invoices()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'accountant'::public.app_role,
    'doctor'::public.app_role
  );
$$;

create or replace function public.can_write_invoices()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'accountant'::public.app_role,
    'doctor'::public.app_role
  );
$$;
