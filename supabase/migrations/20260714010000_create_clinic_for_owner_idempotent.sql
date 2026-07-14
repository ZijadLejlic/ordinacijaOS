-- Idempotent ensure: owners re-logging in at aal1 cannot SELECT their profile
-- (restrictive owner_mfa_ok RLS), so create_clinic_for_owner was called again
-- and raised "Profile already exists", blocking login before MFA redirect.

create or replace function public.create_clinic_for_owner(
  p_clinic_name text,
  p_full_name text,
  p_trial_ends_at timestamp with time zone default '2026-12-31 23:59:59+00'::timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_clinic_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select clinic_id into v_clinic_id
  from public.profiles
  where id = v_user_id;

  if v_clinic_id is not null then
    return v_clinic_id;
  end if;

  select id into v_plan_id
  from public.plans
  where code = 'professional' and is_active = true
  limit 1;

  if v_plan_id is null then
    raise exception 'Professional plan not found';
  end if;

  insert into public.clinics (
    name,
    plan_id,
    trial_ends_at,
    settings_json
  )
  values (
    p_clinic_name,
    v_plan_id,
    p_trial_ends_at,
    jsonb_build_object(
      'onboarding',
      jsonb_build_object(
        'completed', false,
        'step', 1,
        'steps',
        jsonb_build_object(
          'clinic', false,
          'services', false,
          'invite', false
        )
      )
    )
  )
  returning id into v_clinic_id;

  insert into public.profiles (id, clinic_id, role, full_name)
  values (v_user_id, v_clinic_id, 'owner', p_full_name);

  insert into public.clinic_locations (clinic_id, name)
  values (v_clinic_id, 'Glavna lokacija');

  insert into public.clinic_subscriptions (clinic_id, plan_id, status, current_period_end)
  values (v_clinic_id, v_plan_id, 'trial', p_trial_ends_at);

  perform public.seed_default_email_templates(v_clinic_id);

  insert into public.audit_events (clinic_id, actor_user_id, event_name, payload_json)
  values (
    v_clinic_id,
    v_user_id,
    'clinic.created',
    jsonb_build_object('clinic_name', p_clinic_name)
  );

  return v_clinic_id;
end;
$$;

revoke all on function public.create_clinic_for_owner(text, text, timestamptz) from public, anon;
grant execute on function public.create_clinic_for_owner(text, text, timestamptz) to authenticated;
