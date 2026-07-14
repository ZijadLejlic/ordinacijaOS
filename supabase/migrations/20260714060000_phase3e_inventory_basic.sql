-- Faza 3E — Inventar basic (PRD §6.12 / roadmap item 25).
-- Stock levels + low-stock warning. Auto-deduct / barcode / expiry = Premium+ later.
-- Feature gate: inventory_basic (Pro+).
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase3e_inventory_basic

-- ---------------------------------------------------------------------------
-- RBAC helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_access_inventory()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'doctor'::public.app_role,
    'assistant'::public.app_role,
    'reception'::public.app_role
  );
$$;

create or replace function public.can_write_inventory()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'doctor'::public.app_role,
    'assistant'::public.app_role,
    'reception'::public.app_role
  );
$$;

revoke all on function public.can_access_inventory() from public, anon;
revoke all on function public.can_write_inventory() from public, anon;
grant execute on function public.can_access_inventory() to authenticated;
grant execute on function public.can_write_inventory() to authenticated;

-- ---------------------------------------------------------------------------
-- inventory_items
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null
    check (char_length(trim(name)) > 0 and char_length(name) <= 200),
  unit text not null default 'kom'
    check (char_length(trim(unit)) > 0 and char_length(unit) <= 20),
  quantity numeric(12, 2) not null default 0
    check (quantity >= 0),
  low_stock_threshold numeric(12, 2) not null default 0
    check (low_stock_threshold >= 0),
  notes text null
    check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_clinic_name_idx
  on public.inventory_items (clinic_id, name);

create index if not exists inventory_items_clinic_active_qty_idx
  on public.inventory_items (clinic_id, is_active, quantity);

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

create policy inventory_items_select
  on public.inventory_items
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_access_inventory())
  );

create policy inventory_items_insert
  on public.inventory_items
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_inventory())
  );

create policy inventory_items_update
  on public.inventory_items
  for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_inventory())
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_inventory())
  );

create policy inventory_items_owner_mfa_aal2
  on public.inventory_items
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

create policy clinic_writable_insert
  on public.inventory_items
  as restrictive
  for insert
  to authenticated
  with check ((select public.clinic_is_writable()));

create policy clinic_writable_update
  on public.inventory_items
  as restrictive
  for update
  to authenticated
  using ((select public.clinic_is_writable()))
  with check ((select public.clinic_is_writable()));

create policy clinic_writable_delete
  on public.inventory_items
  as restrictive
  for delete
  to authenticated
  using ((select public.clinic_is_writable()));

revoke all on table public.inventory_items from anon;
grant select, insert, update on table public.inventory_items to authenticated;
