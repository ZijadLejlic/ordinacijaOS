-- B5: JWT custom claims — hook function + helper JWT-first reads with profiles fallback.
-- Enable hook in dashboard: Authentication → Hooks → Custom Access Token → public.custom_access_token_hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_clinic_id uuid;
  v_role public.app_role;
  v_user_id uuid;
begin
  v_user_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  select clinic_id, role
  into v_clinic_id, v_role
  from public.profiles
  where id = v_user_id
    and is_active = true;

  if v_clinic_id is null then
    return event;
  end if;

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  claims := jsonb_set(claims, '{app_metadata,clinic_id}', to_jsonb(v_clinic_id::text));
  claims := jsonb_set(claims, '{app_metadata,app_role}', to_jsonb(v_role::text));
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public;
revoke all on function public.custom_access_token_hook(jsonb) from anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt()->'app_metadata'->>'clinic_id', '')::uuid,
    (
      select clinic_id
      from public.profiles
      where id = auth.uid()
        and is_active = true
    )
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt()->'app_metadata'->>'app_role', '')::public.app_role,
    (
      select role
      from public.profiles
      where id = auth.uid()
        and is_active = true
    )
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
    nullif(auth.jwt()->'app_metadata'->>'app_role', '') = 'owner',
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_active = true
        and role = 'owner'
    )
  );
$$;

create or replace function public.owner_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when not (select public.is_clinic_owner()) then true
      when coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2' then true
      when not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
      ) then true
      else false
    end;
$$;
