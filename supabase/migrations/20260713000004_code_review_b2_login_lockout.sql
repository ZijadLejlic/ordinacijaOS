-- B2: Login lockout (D13) — 5 failed attempts → 15 min lock + owner audit event

create or replace function public.check_login_lockout(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_locked_until timestamptz;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return;
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return;
  end if;

  select p.locked_until into v_locked_until
  from public.profiles p
  where p.id = v_user_id and p.is_active = true;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'locked' using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.record_failed_login(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_new_count int;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return;
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id and is_active = true;

  if v_profile.id is null then
    return;
  end if;

  if v_profile.locked_until is not null and v_profile.locked_until > now() then
    return;
  end if;

  v_new_count := v_profile.failed_login_count + 1;

  update public.profiles
  set
    failed_login_count = v_new_count,
    locked_until = case
      when v_new_count >= 5 then now() + interval '15 minutes'
      else locked_until
    end
  where id = v_user_id;

  if v_new_count >= 5 then
    insert into public.audit_events (clinic_id, actor_user_id, event_name, payload_json)
    values (
      v_profile.clinic_id,
      v_user_id,
      'auth.login_lockout',
      jsonb_build_object('profile_id', v_user_id, 'failed_login_count', v_new_count)
    );
  end if;
end;
$$;

create or replace function public.clear_login_lockout()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;

  update public.profiles
  set failed_login_count = 0, locked_until = null
  where id = v_user_id;
end;
$$;

revoke all on function public.check_login_lockout(text) from public;
revoke all on function public.record_failed_login(text) from public;
revoke all on function public.clear_login_lockout() from public;

grant execute on function public.check_login_lockout(text) to anon, authenticated;
grant execute on function public.record_failed_login(text) to anon, authenticated;
grant execute on function public.clear_login_lockout() to authenticated;
