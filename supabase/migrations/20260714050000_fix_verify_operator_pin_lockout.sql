-- D10: PIN desk lockout must persist across failed attempts.
--
-- Root cause: verify_operator_pin() updated pin_failed_count / pin_locked_until then
-- RAISE EXCEPTION 'invalid_pin'. In Postgres that aborts the whole transaction, so the
-- counter never committed (empirically stayed 0 after many wrong PINs).
--
-- Fix: on wrong PIN, update + audit and RETURN (empty result). Clients already treat a
-- missing operator_id as invalid_pin. Lockout is enforced at the start of the next call
-- via RAISE 'locked' (no writes before that raise, so it is safe).

create or replace function public.verify_operator_pin(
  p_operator_id uuid,
  p_pin text
)
returns table (
  operator_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_op public.clinic_operators%rowtype;
  v_profile public.profiles%rowtype;
  v_new_count int;
begin
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'invalid_pin';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id and is_active = true;

  if v_profile.id is null then
    raise exception 'unauthorized';
  end if;

  if v_profile.role not in ('reception', 'assistant') then
    raise exception 'forbidden';
  end if;

  if v_profile.pin_locked_until is not null and v_profile.pin_locked_until > now() then
    raise exception 'locked';
  end if;

  select * into v_op
  from public.clinic_operators
  where id = p_operator_id
    and profile_id = v_user_id
    and clinic_id = v_profile.clinic_id
    and is_active = true;

  if v_op.id is null then
    raise exception 'not_found';
  end if;

  if not public.operator_pin_matches(p_pin, v_op.pin_hash) then
    v_new_count := coalesce(v_profile.pin_failed_count, 0) + 1;

    update public.profiles
    set
      pin_failed_count = v_new_count,
      pin_locked_until = case
        when v_new_count >= 5 then now() + interval '15 minutes'
        else pin_locked_until
      end
    where id = v_user_id;

    insert into public.audit_events (clinic_id, actor_user_id, event_name, payload_json)
    values (
      v_profile.clinic_id,
      v_user_id,
      'operator.pin_failed',
      jsonb_build_object('operator_id', p_operator_id, 'failed_count', v_new_count)
    );

    if v_new_count >= 5 then
      insert into public.audit_events (clinic_id, actor_user_id, event_name, payload_json)
      values (
        v_profile.clinic_id,
        v_user_id,
        'operator.pin_lockout',
        jsonb_build_object('profile_id', v_user_id, 'failed_count', v_new_count)
      );
    end if;

    -- Empty result → client maps to invalidPin; do not RAISE (would roll back counters).
    return;
  end if;

  update public.profiles
  set pin_failed_count = 0, pin_locked_until = null
  where id = v_user_id;

  insert into public.audit_events (clinic_id, actor_user_id, operator_id, event_name, payload_json)
  values (
    v_profile.clinic_id,
    v_user_id,
    v_op.id,
    'operator.switched',
    jsonb_build_object('display_name', v_op.display_name)
  );

  operator_id := v_op.id;
  display_name := v_op.display_name;
  return next;
end;
$$;

revoke all on function public.verify_operator_pin(uuid, text) from public, anon;
grant execute on function public.verify_operator_pin(uuid, text) to authenticated;
