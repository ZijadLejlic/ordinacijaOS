-- TEN-SEC-003 / T-TEN-06: prefer live profiles.role over JWT app_metadata.app_role
-- for authorization helpers.
--
-- B5 (`20260713000006_code_review_b5_jwt_custom_claims.sql`) was JWT-first:
-- coalesce(jwt_claim, profiles). When the Custom Access Token hook is on,
-- a still-valid access token keeps the old app_role after demotion
-- (owner → doctor) until refresh — so is_clinic_owner() stays true and
-- owner-only RLS writes succeed. Access-token revoke alone cannot close
-- this (JWT remains valid until jwt_expiry).
--
-- Fix: profiles-first for role helpers. current_clinic_id() stays JWT-first
-- (v1 clinic_id does not move across tenants — D7). Hook still stamps
-- claims on issue/refresh for clinic_id + fresh role after re-login.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.profiles
      where id = auth.uid()
        and is_active = true
    ),
    nullif(auth.jwt()->'app_metadata'->>'app_role', '')::public.app_role
  );
$$;

create or replace function public.is_clinic_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role = 'owner'
      from public.profiles
      where id = auth.uid()
        and is_active = true
    ),
    nullif(auth.jwt()->'app_metadata'->>'app_role', '') = 'owner'
  );
$$;

comment on function public.current_app_role() is
  'Live profiles.role first, then JWT app_metadata.app_role (TEN-SEC-003 demotion hardening).';

comment on function public.is_clinic_owner() is
  'Live profiles.role = owner first, then JWT claim (TEN-SEC-003 demotion hardening).';
