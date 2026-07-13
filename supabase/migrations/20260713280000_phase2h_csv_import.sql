-- Faza 2H — CSV import: accountant may INSERT services (PRD §3.2).
-- Owner keeps full services write; update/delete stay owner-only via can_write_services().
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase2h_csv_import

create or replace function public.can_import_services()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'accountant'::public.app_role
  );
$$;

revoke all on function public.can_import_services() from public, anon;
grant execute on function public.can_import_services() to authenticated;

drop policy if exists services_insert_owner on public.services;

create policy services_insert_import
  on public.services
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_import_services())
  );
