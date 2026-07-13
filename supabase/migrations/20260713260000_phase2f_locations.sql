-- Faza 2F — locations UI + shared pricelist toggle (D8 / D16).
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase2f_locations_active_limit
--
-- Summary:
--   * Table clinic_locations already existed (Faza 1) with RLS owner write
--     + member select + restrictive MFA.
--   * enforce_location_limits() now counts only is_active = true so soft
--     deactivate frees a plan slot (D8 hard block still applies on INSERT).
--   * App: /settings/locations CRUD + settings_json.shared_pricelist_across_locations
--
-- No new tables. settings_json key shared_pricelist_across_locations (default true).

create or replace function public.enforce_location_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_limits jsonb;
  v_location_limit int;
  v_locations_count int;
begin
  select p.limits_json
  into v_limits
  from public.clinics c
  join public.plans p on p.id = c.plan_id
  where c.id = new.clinic_id;

  if v_limits is null then
    return new;
  end if;

  v_location_limit := nullif(v_limits->>'locations', '')::int;

  select count(*)::int
  into v_locations_count
  from public.clinic_locations
  where clinic_id = new.clinic_id
    and is_active = true;

  if v_location_limit is not null and v_locations_count >= v_location_limit then
    raise exception 'plan_limit_locations' using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

comment on function public.enforce_location_limits() is
  'Hard-block plan location limits on clinic_locations INSERT (D8). Counts active locations only.';

revoke all on function public.enforce_location_limits() from public;
revoke all on function public.enforce_location_limits() from anon, authenticated;
