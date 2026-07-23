-- Faza 1 — Foundation (P0.1 reproducible schema).
--
-- This is the FIRST migration applied to a fresh local/CI database. It recreates the
-- Faza 1 tables, enums, RBAC bootstrap helpers, PIN/invite/operator functions, triggers
-- and baseline RLS policies exactly as they exist on the remote Supabase project
-- (see docs/QA/Discrepancies.md D-01 and docs/DB-OrdinacijaOS.md §3/§10 for provenance).
--
-- IMPORTANT ordering note: `current_clinic_id()`, `current_app_role()`, `is_clinic_owner()`
-- and `owner_mfa_ok()` are bootstrapped here (simple `profiles`-only lookups) because the
-- next migrations in sequence (`20260713000001_code_review_a1_...`,
-- `20260713000004_code_review_b2_...`, `20260713000005_code_review_b4_...`) already use them
-- inside `CREATE POLICY` expressions, which Postgres resolves/binds at creation time (unlike
-- plpgsql function bodies, which are not validated until executed). `20260713000006_code_
-- review_b5_jwt_custom_claims.sql` later `CREATE OR REPLACE`s these same 4 functions with the
-- JWT-app_metadata-first + profiles-fallback versions — that is expected and matches the real
-- migration history; grants set here persist across the replace.

-- ---------------------------------------------------------------------------
-- Extensions (defensive — Supabase projects normally already have these)
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'owner', 'doctor', 'assistant', 'reception', 'accountant', 'technician'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'clinic_status') then
    create type public.clinic_status as enum ('active', 'readonly', 'pending_delete');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'trial', 'active', 'past_due', 'canceled', 'readonly'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables (creation order satisfies FKs)
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_eur_monthly numeric(10, 2) not null,
  limits_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_code_check check (
    code in ('starter', 'professional', 'premium_ai', 'enterprise')
  )
);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  is_metered boolean not null default false,
  created_at timestamptz not null default now(),
  constraint plan_entitlements_plan_feature_key unique (plan_id, feature_key)
);

create index if not exists plan_entitlements_plan_id_idx
  on public.plan_entitlements (plan_id);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid not null references public.plans (id),
  trial_ends_at timestamptz,
  timezone text not null default 'Europe/Sarajevo',
  phone_country_default text not null default '+387',
  branding_json jsonb not null default '{}'::jsonb,
  settings_json jsonb not null default jsonb_build_object(
    'doctors_see_peer_amounts', false,
    'shared_pricelist_across_locations', true,
    'ai_enabled', false
  ),
  status public.clinic_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  readonly_started_at timestamptz,
  grace_ends_at timestamptz,
  closure_reason text,
  is_demo boolean not null default false,
  constraint clinics_closure_reason_check check (
    closure_reason is null
    or closure_reason in ('trial_expired', 'owner_requested', 'unpaid')
  )
);

create index if not exists clinics_plan_id_idx
  on public.clinics (plan_id);
create index if not exists clinics_lifecycle_status_grace_idx
  on public.clinics (status, grace_ends_at)
  where status in ('readonly', 'pending_delete');
create index if not exists clinics_lifecycle_trial_idx
  on public.clinics (status, trial_ends_at)
  where status = 'active' and trial_ends_at is not null;
create unique index if not exists clinics_is_demo_unique_idx
  on public.clinics (is_demo)
  where is_demo = true;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  role public.app_role not null,
  full_name text not null,
  is_active boolean not null default true,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pin_failed_count int not null default 0,
  pin_locked_until timestamptz
);

create index if not exists profiles_clinic_id_idx
  on public.profiles (clinic_id);
create unique index if not exists profiles_one_active_owner_per_clinic_idx
  on public.profiles (clinic_id)
  where role = 'owner' and is_active = true;

create table if not exists public.clinic_locations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_locations_clinic_id_idx
  on public.clinic_locations (clinic_id);

create table if not exists public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.app_role not null,
  token_hash text not null unique,
  status public.invite_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_invites_role_not_owner_check check (role <> 'owner')
);

create index if not exists clinic_invites_clinic_id_idx
  on public.clinic_invites (clinic_id);
create index if not exists clinic_invites_invited_by_idx
  on public.clinic_invites (invited_by);
-- Dropped later by 20260713000005_code_review_b4_rls_performance.sql (kept here so the
-- migration replay history matches remote: created in Faza 1, retired in the B4 pass).
create unique index if not exists clinic_invites_pending_email_idx
  on public.clinic_invites (clinic_id, lower(email))
  where status = 'pending';

create table if not exists public.clinic_operators (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  pin_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_operators_clinic_id_idx
  on public.clinic_operators (clinic_id);
create index if not exists clinic_operators_profile_id_idx
  on public.clinic_operators (profile_id);

create table if not exists public.clinic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'trial',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_subscriptions_plan_id_idx
  on public.clinic_subscriptions (plan_id);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  operator_id uuid references public.clinic_operators (id) on delete set null,
  event_name text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_actor_user_id_idx
  on public.audit_events (actor_user_id);
create index if not exists audit_events_operator_id_idx
  on public.audit_events (operator_id);
create index if not exists audit_events_clinic_id_created_at_idx
  on public.audit_events (clinic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RBAC bootstrap helpers (baseline profiles-only lookups — B5 upgrades these to
-- JWT-app_metadata-first with profiles fallback via CREATE OR REPLACE)
-- ---------------------------------------------------------------------------

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select clinic_id
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path to 'public'
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

create or replace function public.is_clinic_owner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'owner'
  );
$$;

create or replace function public.owner_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    case
      when not (select public.is_clinic_owner()) then true
      when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
      when not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
      ) then true
      else false
    end;
$$;

revoke all on function public.current_clinic_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.is_clinic_owner() from public;
revoke all on function public.owner_mfa_ok() from public;

revoke all on function public.current_clinic_id() from anon;
revoke all on function public.current_app_role() from anon;
revoke all on function public.is_clinic_owner() from anon;
revoke all on function public.owner_mfa_ok() from anon;

grant execute on function public.current_clinic_id() to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.is_clinic_owner() to authenticated, service_role;
grant execute on function public.owner_mfa_ok() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_updated_at trigger function + triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

grant execute on function public.set_updated_at() to anon, authenticated, service_role;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row
execute function public.set_updated_at();

drop trigger if exists clinics_set_updated_at on public.clinics;
create trigger clinics_set_updated_at
before update on public.clinics
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists clinic_locations_set_updated_at on public.clinic_locations;
create trigger clinic_locations_set_updated_at
before update on public.clinic_locations
for each row
execute function public.set_updated_at();

drop trigger if exists clinic_invites_set_updated_at on public.clinic_invites;
create trigger clinic_invites_set_updated_at
before update on public.clinic_invites
for each row
execute function public.set_updated_at();

drop trigger if exists clinic_operators_set_updated_at on public.clinic_operators;
create trigger clinic_operators_set_updated_at
before update on public.clinic_operators
for each row
execute function public.set_updated_at();

drop trigger if exists clinic_subscriptions_set_updated_at on public.clinic_subscriptions;
create trigger clinic_subscriptions_set_updated_at
before update on public.clinic_subscriptions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- PIN hashing helpers (D10)
-- ---------------------------------------------------------------------------

create or replace function public.hash_operator_pin(p_pin text)
returns text
language sql
immutable
set search_path to 'public', 'extensions'
as $function$
  select extensions.crypt(p_pin, extensions.gen_salt('bf', 8))
$function$;

create or replace function public.operator_pin_matches(p_pin text, p_hash text)
returns boolean
language sql
immutable
set search_path to 'public', 'extensions'
as $function$
  select p_hash = extensions.crypt(p_pin, p_hash)
$function$;

-- ---------------------------------------------------------------------------
-- Invite lifecycle RPCs (D9)
-- ---------------------------------------------------------------------------

create or replace function public.expire_stale_clinic_invites(p_clinic_id uuid default null::uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  update public.clinic_invites
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at < now()
    and (p_clinic_id is null or clinic_id = p_clinic_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.accept_clinic_invite(p_token_hash text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invite public.clinic_invites%rowtype;
  v_email text;
begin
  if p_user_id is null or p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Invalid accept request';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'User not found';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profile already exists';
  end if;

  select * into v_invite from public.clinic_invites where token_hash = p_token_hash for update;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.status = 'pending' and v_invite.expires_at < now() then
    update public.clinic_invites set status = 'expired', updated_at = now() where id = v_invite.id;
    raise exception 'Invite expired';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'Invite email mismatch';
  end if;

  if v_invite.role = 'owner' then
    raise exception 'Cannot accept owner invite';
  end if;

  insert into public.profiles (id, clinic_id, role, full_name)
  values (p_user_id, v_invite.clinic_id, v_invite.role, v_invite.full_name);

  update public.clinic_invites
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = v_invite.id;

  insert into public.audit_events (clinic_id, actor_user_id, event_name, payload_json)
  values (v_invite.clinic_id, p_user_id, 'invite.accepted',
    jsonb_build_object('invite_id', v_invite.id, 'role', v_invite.role));

  return v_invite.clinic_id;
end;
$function$;

create or replace function public.peek_clinic_invite(p_token_hash text)
returns table(invite_id uuid, clinic_id uuid, clinic_name text, email text, full_name text, role public.app_role, expires_at timestamp with time zone, status public.invite_status)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invite public.clinic_invites%rowtype;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    return;
  end if;

  select * into v_invite from public.clinic_invites where token_hash = p_token_hash;
  if not found then
    return;
  end if;

  if v_invite.status = 'pending' and v_invite.expires_at < now() then
    update public.clinic_invites set status = 'expired', updated_at = now() where id = v_invite.id;
    v_invite.status := 'expired';
  end if;

  return query
  select v_invite.id, v_invite.clinic_id, c.name, v_invite.email, v_invite.full_name,
    v_invite.role, v_invite.expires_at, v_invite.status
  from public.clinics c where c.id = v_invite.clinic_id;
end;
$function$;

create or replace function public.auth_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path to 'public', 'auth'
as $function$
  select exists (select 1 from auth.users u where lower(u.email) = lower(p_email));
$function$;

-- ---------------------------------------------------------------------------
-- Shared desk PIN operators (D10)
-- ---------------------------------------------------------------------------

create or replace function public.create_clinic_operator(p_profile_id uuid, p_display_name text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_clinic_id uuid := public.current_clinic_id();
  v_operator_id uuid;
  v_existing record;
begin
  if not public.is_clinic_owner() or not public.owner_mfa_ok() then
    raise exception 'forbidden';
  end if;

  if p_display_name is null or length(trim(p_display_name)) < 1 or length(trim(p_display_name)) > 80 then
    raise exception 'invalid_name';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'invalid_pin';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and clinic_id = v_clinic_id and is_active = true
      and role in ('reception', 'assistant')
  ) then
    raise exception 'invalid_profile';
  end if;

  for v_existing in
    select pin_hash from public.clinic_operators where profile_id = p_profile_id and is_active = true
  loop
    if public.operator_pin_matches(p_pin, v_existing.pin_hash) then
      raise exception 'pin_taken';
    end if;
  end loop;

  insert into public.clinic_operators (clinic_id, profile_id, display_name, pin_hash)
  values (v_clinic_id, p_profile_id, trim(p_display_name), public.hash_operator_pin(p_pin))
  returning id into v_operator_id;

  insert into public.audit_events (clinic_id, actor_user_id, operator_id, event_name, payload_json)
  values (v_clinic_id, auth.uid(), v_operator_id, 'operator.created',
    jsonb_build_object('profile_id', p_profile_id, 'display_name', trim(p_display_name)));

  return v_operator_id;
end;
$function$;

create or replace function public.set_clinic_operator_active(p_operator_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_clinic_id uuid := public.current_clinic_id();
begin
  if not public.is_clinic_owner() or not public.owner_mfa_ok() then
    raise exception 'forbidden';
  end if;

  update public.clinic_operators set is_active = p_is_active
  where id = p_operator_id and clinic_id = v_clinic_id;

  if not found then
    raise exception 'not_found';
  end if;

  insert into public.audit_events (clinic_id, actor_user_id, operator_id, event_name, payload_json)
  values (v_clinic_id, auth.uid(), p_operator_id,
    case when p_is_active then 'operator.reactivated' else 'operator.deactivated' end, '{}'::jsonb);
end;
$function$;

create or replace function public.update_clinic_operator_pin(p_operator_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_clinic_id uuid := public.current_clinic_id();
  v_profile_id uuid;
  v_existing record;
begin
  if not public.is_clinic_owner() or not public.owner_mfa_ok() then
    raise exception 'forbidden';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'invalid_pin';
  end if;

  select profile_id into v_profile_id from public.clinic_operators
  where id = p_operator_id and clinic_id = v_clinic_id;

  if v_profile_id is null then
    raise exception 'not_found';
  end if;

  for v_existing in
    select id, pin_hash from public.clinic_operators
    where profile_id = v_profile_id and is_active = true and id <> p_operator_id
  loop
    if public.operator_pin_matches(p_pin, v_existing.pin_hash) then
      raise exception 'pin_taken';
    end if;
  end loop;

  update public.clinic_operators set pin_hash = public.hash_operator_pin(p_pin)
  where id = p_operator_id and clinic_id = v_clinic_id;

  insert into public.audit_events (clinic_id, actor_user_id, operator_id, event_name, payload_json)
  values (v_clinic_id, auth.uid(), p_operator_id, 'operator.pin_reset', '{}'::jsonb);
end;
$function$;

create or replace function public.operator_belongs_to_me(p_operator_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.clinic_operators o
    where o.id = p_operator_id and o.profile_id = auth.uid() and o.is_active = true
  )
$function$;

create or replace function public.shared_desk_needs_pin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    join public.clinic_operators o on o.profile_id = p.id and o.is_active = true
    where p.id = auth.uid() and p.is_active = true and p.role in ('reception', 'assistant')
  )
$function$;

create or replace function public.clinic_operators_enforce_shared_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role public.app_role;
  v_clinic_id uuid;
begin
  select role, clinic_id into v_role, v_clinic_id from public.profiles where id = new.profile_id;

  if v_role is null then
    raise exception 'Profile not found';
  end if;

  if v_role not in ('reception', 'assistant') then
    raise exception 'Operators only for reception/assistant profiles';
  end if;

  if new.clinic_id is distinct from v_clinic_id then
    raise exception 'Operator clinic_id must match profile clinic';
  end if;

  return new;
end;
$function$;

drop trigger if exists clinic_operators_enforce_shared_role on public.clinic_operators;
create trigger clinic_operators_enforce_shared_role
before insert or update of profile_id, clinic_id on public.clinic_operators
for each row
execute function public.clinic_operators_enforce_shared_role();

-- ---------------------------------------------------------------------------
-- Grants — Faza 1 functions
-- ---------------------------------------------------------------------------

-- service_role only (pre-login / invite-accept flows run before a client Supabase Auth
-- session exists; server actions use the service-role client for these).
revoke all on function public.hash_operator_pin(text) from public, anon, authenticated;
revoke all on function public.operator_pin_matches(text, text) from public, anon, authenticated;
revoke all on function public.clinic_operators_enforce_shared_role() from public, anon, authenticated;
revoke all on function public.auth_email_exists(text) from public, anon, authenticated;
revoke all on function public.accept_clinic_invite(text, uuid) from public, anon, authenticated;
revoke all on function public.peek_clinic_invite(text) from public, anon, authenticated;

grant execute on function public.hash_operator_pin(text) to service_role;
grant execute on function public.operator_pin_matches(text, text) to service_role;
grant execute on function public.clinic_operators_enforce_shared_role() to service_role;
grant execute on function public.auth_email_exists(text) to service_role;
grant execute on function public.accept_clinic_invite(text, uuid) to service_role;
grant execute on function public.peek_clinic_invite(text) to service_role;

-- authenticated + service_role
revoke all on function public.expire_stale_clinic_invites(uuid) from public, anon;
revoke all on function public.operator_belongs_to_me(uuid) from public, anon;
revoke all on function public.shared_desk_needs_pin() from public, anon;
revoke all on function public.create_clinic_operator(uuid, text, text) from public, anon;
revoke all on function public.set_clinic_operator_active(uuid, boolean) from public, anon;
revoke all on function public.update_clinic_operator_pin(uuid, text) from public, anon;

grant execute on function public.expire_stale_clinic_invites(uuid) to authenticated, service_role;
grant execute on function public.operator_belongs_to_me(uuid) to authenticated, service_role;
grant execute on function public.shared_desk_needs_pin() to authenticated, service_role;
grant execute on function public.create_clinic_operator(uuid, text, text) to authenticated, service_role;
grant execute on function public.set_clinic_operator_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.update_clinic_operator_pin(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS — enable on all 9 tables (belt-and-braces; also see rls_auto_enable below)
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_locations enable row level security;
alter table public.clinic_invites enable row level security;
alter table public.clinic_operators enable row level security;
alter table public.clinic_subscriptions enable row level security;
alter table public.audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- RLS — baseline policies (exact names per docs/QA/P0-Handoff-Schema-Dump.md so later
-- migrations' `drop policy if exists <name> ... create policy <name>` statements resolve
-- without "already exists" errors)
-- ---------------------------------------------------------------------------

-- plans
drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated
on public.plans
for select
to authenticated
using (is_active = true);

-- plan_entitlements
drop policy if exists plan_entitlements_select_authenticated on public.plan_entitlements;
create policy plan_entitlements_select_authenticated
on public.plan_entitlements
for select
to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_entitlements.plan_id and p.is_active = true
  )
);

-- clinics
drop policy if exists clinics_select_member on public.clinics;
create policy clinics_select_member
on public.clinics
for select
to authenticated
using (id = current_clinic_id());

drop policy if exists clinics_update_owner on public.clinics;
create policy clinics_update_owner
on public.clinics
for update
to authenticated
using (id = current_clinic_id() and is_clinic_owner())
with check (id = current_clinic_id() and is_clinic_owner());

drop policy if exists clinics_owner_mfa_aal2 on public.clinics;
create policy clinics_owner_mfa_aal2
on public.clinics
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- profiles (baseline, pre-A1-hardening; A1/B4 replace via drop-if-exists)
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_update_owner_staff on public.profiles;
create policy profiles_update_owner_staff
on public.profiles
for update
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner())
with check (clinic_id = current_clinic_id() and is_clinic_owner());

drop policy if exists profiles_select_same_clinic on public.profiles;
create policy profiles_select_same_clinic
on public.profiles
for select
to authenticated
using (clinic_id = current_clinic_id());

-- clinic_locations (baseline ALL owner policy; B4 drops + splits into insert/update/delete)
drop policy if exists clinic_locations_write_owner on public.clinic_locations;
create policy clinic_locations_write_owner
on public.clinic_locations
for all
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner())
with check (clinic_id = current_clinic_id() and is_clinic_owner());

drop policy if exists clinic_locations_select_member on public.clinic_locations;
create policy clinic_locations_select_member
on public.clinic_locations
for select
to authenticated
using (clinic_id = current_clinic_id());

-- clinic_operators (baseline ALL owner policy; B4 drops + splits)
drop policy if exists clinic_operators_write_owner on public.clinic_operators;
create policy clinic_operators_write_owner
on public.clinic_operators
for all
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner())
with check (clinic_id = current_clinic_id() and is_clinic_owner());

drop policy if exists clinic_operators_select_member on public.clinic_operators;
create policy clinic_operators_select_member
on public.clinic_operators
for select
to authenticated
using (clinic_id = current_clinic_id());

-- clinic_invites (baseline ALL owner policy; B4 drops + splits)
drop policy if exists clinic_invites_write_owner on public.clinic_invites;
create policy clinic_invites_write_owner
on public.clinic_invites
for all
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner())
with check (clinic_id = current_clinic_id() and is_clinic_owner());

drop policy if exists clinic_invites_select_owner on public.clinic_invites;
create policy clinic_invites_select_owner
on public.clinic_invites
for select
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner());

-- clinic_subscriptions — no INSERT/DELETE policy by design (D-13 spot-check): rows are
-- created only via create_clinic_for_owner() (SECURITY DEFINER) or service_role.
drop policy if exists clinic_subscriptions_select_owner on public.clinic_subscriptions;
create policy clinic_subscriptions_select_owner
on public.clinic_subscriptions
for select
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner());

drop policy if exists clinic_subscriptions_update_owner on public.clinic_subscriptions;
create policy clinic_subscriptions_update_owner
on public.clinic_subscriptions
for update
to authenticated
using (clinic_id = current_clinic_id() and is_clinic_owner())
with check (clinic_id = current_clinic_id() and is_clinic_owner());

-- audit_events (baseline select-all-members; phase3c_audit_log_ui.sql narrows to owner-only)
drop policy if exists audit_events_insert_member on public.audit_events;
create policy audit_events_insert_member
on public.audit_events
for insert
to authenticated
with check (clinic_id = current_clinic_id() and actor_user_id = auth.uid());

drop policy if exists audit_events_select_member on public.audit_events;
create policy audit_events_select_member
on public.audit_events
for select
to authenticated
using (clinic_id = current_clinic_id());

-- NOTE: `clinic_writable_insert/update/delete` restrictive policies (all clinic-scoped
-- tables) are created later by 20260714030000_phase3c_clinic_lifecycle.sql's table-array
-- loop — do NOT create them here or that migration's bare `create policy` (no drop-if-
-- exists in its loop) will fail with "already exists".
-- NOTE: `profiles_owner_mfa_aal2` / `audit_events_owner_mfa_aal2` are created fresh by
-- 20260713000005_code_review_b4_rls_performance.sql — do NOT create them here.

-- ---------------------------------------------------------------------------
-- rls_auto_enable — event trigger safety net (belt-and-braces alongside the explicit
-- `alter table ... enable row level security` statements above)
-- ---------------------------------------------------------------------------

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (system schema or not enforced: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

drop event trigger if exists rls_auto_enable_trg;
create event trigger rls_auto_enable_trg
on ddl_command_end
execute function public.rls_auto_enable();
