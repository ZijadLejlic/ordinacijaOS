-- B4: RLS performance — select-wrapped helpers, FK indexes, dedupe index,
-- split owner write policies off SELECT to avoid multiple permissive policies.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists audit_events_operator_id_idx
  on public.audit_events (operator_id);

create index if not exists clinic_invites_invited_by_idx
  on public.clinic_invites (invited_by);

create index if not exists clinic_subscriptions_plan_id_idx
  on public.clinic_subscriptions (plan_id);

create index if not exists clinics_plan_id_idx
  on public.clinics (plan_id);

drop index if exists public.clinic_invites_pending_email_idx;

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

drop policy if exists audit_events_insert_member on public.audit_events;
create policy audit_events_insert_member
on public.audit_events
for insert
to authenticated
with check (
  clinic_id = (select current_clinic_id())
  and actor_user_id = (select auth.uid())
);

drop policy if exists audit_events_select_member on public.audit_events;
create policy audit_events_select_member
on public.audit_events
for select
to authenticated
using (clinic_id = (select current_clinic_id()));

drop policy if exists audit_events_owner_mfa_aal2 on public.audit_events;
create policy audit_events_owner_mfa_aal2
on public.audit_events
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));

-- ---------------------------------------------------------------------------
-- clinic_invites — owner write split (INSERT/UPDATE/DELETE only)
-- ---------------------------------------------------------------------------

drop policy if exists clinic_invites_write_owner on public.clinic_invites;

create policy clinic_invites_insert_owner
on public.clinic_invites
for insert
to authenticated
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

create policy clinic_invites_update_owner
on public.clinic_invites
for update
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
)
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

create policy clinic_invites_delete_owner
on public.clinic_invites
for delete
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinic_invites_select_owner on public.clinic_invites;
create policy clinic_invites_select_owner
on public.clinic_invites
for select
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinic_invites_owner_mfa_aal2 on public.clinic_invites;
create policy clinic_invites_owner_mfa_aal2
on public.clinic_invites
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));

-- ---------------------------------------------------------------------------
-- clinic_locations
-- ---------------------------------------------------------------------------

drop policy if exists clinic_locations_write_owner on public.clinic_locations;

create policy clinic_locations_insert_owner
on public.clinic_locations
for insert
to authenticated
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

create policy clinic_locations_update_owner
on public.clinic_locations
for update
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
)
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

create policy clinic_locations_delete_owner
on public.clinic_locations
for delete
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinic_locations_select_member on public.clinic_locations;
create policy clinic_locations_select_member
on public.clinic_locations
for select
to authenticated
using (clinic_id = (select current_clinic_id()));

drop policy if exists clinic_locations_owner_mfa_aal2 on public.clinic_locations;
create policy clinic_locations_owner_mfa_aal2
on public.clinic_locations
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));

-- ---------------------------------------------------------------------------
-- clinic_operators
-- ---------------------------------------------------------------------------

drop policy if exists clinic_operators_write_owner on public.clinic_operators;

create policy clinic_operators_insert_owner
on public.clinic_operators
for insert
to authenticated
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

create policy clinic_operators_update_owner
on public.clinic_operators
for update
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
)
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

create policy clinic_operators_delete_owner
on public.clinic_operators
for delete
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinic_operators_select_member on public.clinic_operators;
create policy clinic_operators_select_member
on public.clinic_operators
for select
to authenticated
using (clinic_id = (select current_clinic_id()));

drop policy if exists clinic_operators_owner_mfa_aal2 on public.clinic_operators;
create policy clinic_operators_owner_mfa_aal2
on public.clinic_operators
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));

-- ---------------------------------------------------------------------------
-- clinic_subscriptions
-- ---------------------------------------------------------------------------

drop policy if exists clinic_subscriptions_select_owner on public.clinic_subscriptions;
create policy clinic_subscriptions_select_owner
on public.clinic_subscriptions
for select
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinic_subscriptions_update_owner on public.clinic_subscriptions;
create policy clinic_subscriptions_update_owner
on public.clinic_subscriptions
for update
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
)
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinic_subscriptions_owner_mfa_aal2 on public.clinic_subscriptions;
create policy clinic_subscriptions_owner_mfa_aal2
on public.clinic_subscriptions
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));

-- ---------------------------------------------------------------------------
-- clinics
-- ---------------------------------------------------------------------------

drop policy if exists clinics_select_member on public.clinics;
create policy clinics_select_member
on public.clinics
for select
to authenticated
using (id = (select current_clinic_id()));

drop policy if exists clinics_update_owner on public.clinics;
create policy clinics_update_owner
on public.clinics
for update
to authenticated
using (
  id = (select current_clinic_id())
  and (select is_clinic_owner())
)
with check (
  id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists clinics_owner_mfa_aal2 on public.clinics;
create policy clinics_owner_mfa_aal2
on public.clinics
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));

-- ---------------------------------------------------------------------------
-- profiles — keep separate UPDATE policies (merged policy caused RLS recursion)
-- ---------------------------------------------------------------------------

drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_owner_staff on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and clinic_id = (select current_clinic_id())
);

create policy profiles_update_owner_staff
on public.profiles
for update
to authenticated
using (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
)
with check (
  clinic_id = (select current_clinic_id())
  and (select is_clinic_owner())
);

drop policy if exists profiles_select_same_clinic on public.profiles;
create policy profiles_select_same_clinic
on public.profiles
for select
to authenticated
using (clinic_id = (select current_clinic_id()));

drop policy if exists profiles_owner_mfa_aal2 on public.profiles;
create policy profiles_owner_mfa_aal2
on public.profiles
as restrictive
for all
to authenticated
using ((select owner_mfa_ok()))
with check ((select owner_mfa_ok()));
