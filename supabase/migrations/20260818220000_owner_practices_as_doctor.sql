-- D56: Owner may practice as a doctor on the same account (solo clinics).
-- Bookable resource = role=doctor OR (role=owner AND practices_as_doctor).
-- Practicing owner counts as a doctor plan seat (D8).

alter table public.profiles
  add column if not exists practices_as_doctor boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_practices_as_doctor_owner_only;

alter table public.profiles
  add constraint profiles_practices_as_doctor_owner_only
  check (practices_as_doctor = false or role = 'owner');

comment on column public.profiles.practices_as_doctor is
  'Owner-only: when true, this profile is a bookable doctor (appointments/invoices) while remaining owner. Counts as a doctor plan seat.';

grant update (practices_as_doctor) on public.profiles to authenticated;

create or replace function public.clinic_doctor_seat_count(p_clinic_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from (
    select 1
    from public.profiles
    where clinic_id = p_clinic_id
      and is_active
      and (role = 'doctor' or (role = 'owner' and practices_as_doctor))
    union all
    select 1
    from public.clinic_invites
    where clinic_id = p_clinic_id
      and status = 'pending'
      and role = 'doctor'
  ) seats;
$$;

revoke all on function public.clinic_doctor_seat_count(uuid) from public;
revoke all on function public.clinic_doctor_seat_count(uuid) from anon, authenticated;

comment on function public.clinic_doctor_seat_count(uuid) is
  'Active bookable doctors (role=doctor or practicing owner) plus pending doctor invites.';

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
    v_doctors_count := public.clinic_doctor_seat_count(new.clinic_id);

    if v_doctors_count >= v_doctor_limit then
      raise exception 'plan_limit_doctors' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_invite_limits() is
  'Hard-block plan user/doctor limits on clinic_invites INSERT (D8). Doctor seats include practicing owners (D56).';

create or replace function public.enforce_practices_as_doctor_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_doctor_limit int;
  v_doctors_count int;
begin
  if not (
    new.practices_as_doctor = true
    and (tg_op = 'INSERT' or old.practices_as_doctor is distinct from true)
  ) then
    return new;
  end if;

  if new.role is distinct from 'owner' then
    return new;
  end if;

  select p.limits_json
  into v_limits
  from public.clinics c
  join public.plans p on p.id = c.plan_id
  where c.id = new.clinic_id;

  if v_limits is null then
    return new;
  end if;

  v_doctor_limit := nullif(v_limits->>'doctors', '')::int;
  if v_doctor_limit is null then
    return new;
  end if;

  -- BEFORE INSERT/UPDATE: this row is not yet counted as practicing.
  v_doctors_count := public.clinic_doctor_seat_count(new.clinic_id);
  if v_doctors_count >= v_doctor_limit then
    raise exception 'plan_limit_doctors' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_practices_as_doctor_limit on public.profiles;

create trigger profiles_enforce_practices_as_doctor_limit
before insert or update of practices_as_doctor on public.profiles
for each row
execute function public.enforce_practices_as_doctor_limit();

revoke all on function public.enforce_practices_as_doctor_limit() from public;
revoke all on function public.enforce_practices_as_doctor_limit() from anon, authenticated;

comment on function public.enforce_practices_as_doctor_limit() is
  'Hard-block doctor plan limit when an owner turns on practices_as_doctor (D8/D56).';

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'profile_clinic_id_immutable' using errcode = '42501';
  end if;

  if new.practices_as_doctor is true and new.role is distinct from 'owner' then
    raise exception 'practices_as_doctor_owner_only' using errcode = '42501';
  end if;

  if new.id = (select auth.uid()) then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active then
      raise exception 'profile_self_privilege_escalation' using errcode = '42501';
    end if;
    if new.practices_as_doctor is distinct from old.practices_as_doctor
       and old.role is distinct from 'owner' then
      raise exception 'profile_self_privilege_escalation' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.profiles_guard_sensitive_columns() is
  'Blocks self role/is_active escalation, clinic_id change, and non-owner practices_as_doctor (A1 / D56).';
