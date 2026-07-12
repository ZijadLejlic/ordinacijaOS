-- A2: Enforce plan limits at DB layer (D8 hard block / CODE-REVIEW-2026-07)

create or replace function public.enforce_invite_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_user_limit int;
  v_doctor_limit int;
  v_users_count int;
  v_doctors_count int;
begin
  perform public.expire_stale_clinic_invites(new.clinic_id);

  select p.limits_json
  into v_limits
  from public.clinics c
  join public.plans p on p.id = c.plan_id
  where c.id = new.clinic_id;

  if v_limits is null then
    return new;
  end if;

  v_user_limit := nullif(v_limits->>'users', '')::int;
  v_doctor_limit := nullif(v_limits->>'doctors', '')::int;

  select count(*)::int
  into v_users_count
  from (
    select 1
    from public.profiles
    where clinic_id = new.clinic_id
      and is_active
    union all
    select 1
    from public.clinic_invites
    where clinic_id = new.clinic_id
      and status = 'pending'
  ) reserved_seats;

  if v_user_limit is not null and v_users_count >= v_user_limit then
    raise exception 'plan_limit_users' using errcode = 'check_violation';
  end if;

  if new.role = 'doctor' and v_doctor_limit is not null then
    select count(*)::int
    into v_doctors_count
    from (
      select 1
      from public.profiles
      where clinic_id = new.clinic_id
        and is_active
        and role = 'doctor'
      union all
      select 1
      from public.clinic_invites
      where clinic_id = new.clinic_id
        and status = 'pending'
        and role = 'doctor'
    ) doctor_seats;

    if v_doctors_count >= v_doctor_limit then
      raise exception 'plan_limit_doctors' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clinic_invites_enforce_limits on public.clinic_invites;

create trigger clinic_invites_enforce_limits
before insert on public.clinic_invites
for each row
execute function public.enforce_invite_limits();

create or replace function public.enforce_location_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  where clinic_id = new.clinic_id;

  if v_location_limit is not null and v_locations_count >= v_location_limit then
    raise exception 'plan_limit_locations' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists clinic_locations_enforce_limits on public.clinic_locations;

create trigger clinic_locations_enforce_limits
before insert on public.clinic_locations
for each row
execute function public.enforce_location_limits();

revoke all on function public.enforce_invite_limits() from public;
revoke all on function public.enforce_location_limits() from public;

revoke all on function public.enforce_invite_limits() from anon, authenticated;
revoke all on function public.enforce_location_limits() from anon, authenticated;

comment on function public.enforce_invite_limits() is
  'Hard-block plan user/doctor limits on clinic_invites INSERT (D8).';
comment on function public.enforce_location_limits() is
  'Hard-block plan location limits on clinic_locations INSERT (D8).';
