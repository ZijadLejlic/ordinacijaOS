-- W8: marketing live demo clinic — exempt from lifecycle delete
alter table public.clinics
  add column if not exists is_demo boolean not null default false;

comment on column public.clinics.is_demo is
  'Marketing seed clinic (W8). Excluded from lifecycle transitions and hard delete.';

create unique index if not exists clinics_one_demo_idx
  on public.clinics ((is_demo))
  where is_demo = true;

-- Skip demo clinics in trial/unpaid → readonly and readonly → pending_delete
create or replace function public.run_clinic_lifecycle_transitions()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_readonly_ids uuid[] := '{}';
  v_pending_ids uuid[] := '{}';
  v_id uuid;
  v_grace timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  for v_id in
    select c.id
    from public.clinics c
    where c.status = 'active'::public.clinic_status
      and c.is_demo = false
      and (
        (
          c.trial_ends_at is not null
          and c.trial_ends_at < now()
          and not exists (
            select 1
            from public.clinic_subscriptions cs
            where cs.clinic_id = c.id
              and cs.status = 'active'::public.subscription_status
              and (
                cs.current_period_end is null
                or cs.current_period_end > now()
              )
          )
        )
        or exists (
          select 1
          from public.clinic_subscriptions cs
          where cs.clinic_id = c.id
            and cs.status in (
              'past_due'::public.subscription_status,
              'canceled'::public.subscription_status,
              'readonly'::public.subscription_status
            )
            and cs.current_period_end is not null
            and cs.current_period_end < now()
        )
      )
  loop
    v_grace := now() + interval '7 days';

    update public.clinics
    set
      status = 'readonly'::public.clinic_status,
      readonly_started_at = coalesce(readonly_started_at, now()),
      grace_ends_at = coalesce(grace_ends_at, v_grace),
      closure_reason = coalesce(
        closure_reason,
        case
          when trial_ends_at is not null and trial_ends_at < now() then 'trial_expired'
          else 'unpaid'
        end
      ),
      updated_at = now()
    where id = v_id;

    update public.clinic_subscriptions
    set status = 'readonly'::public.subscription_status, updated_at = now()
    where clinic_id = v_id
      and status in (
        'trial'::public.subscription_status,
        'past_due'::public.subscription_status,
        'canceled'::public.subscription_status
      );

    insert into public.audit_events (
      clinic_id, actor_user_id, event_name, payload_json
    ) values (
      v_id,
      null,
      'clinic.marked_readonly',
      jsonb_build_object('grace_ends_at', v_grace, 'source', 'lifecycle_job')
    );

    v_readonly_ids := array_append(v_readonly_ids, v_id);
  end loop;

  for v_id in
    select c.id
    from public.clinics c
    where c.status = 'readonly'::public.clinic_status
      and c.is_demo = false
      and c.grace_ends_at is not null
      and c.grace_ends_at < now()
  loop
    update public.clinics
    set status = 'pending_delete'::public.clinic_status, updated_at = now()
    where id = v_id;

    insert into public.audit_events (
      clinic_id, actor_user_id, event_name, payload_json
    ) values (
      v_id,
      null,
      'clinic.marked_pending_delete',
      jsonb_build_object('source', 'lifecycle_job')
    );

    v_pending_ids := array_append(v_pending_ids, v_id);
  end loop;

  return jsonb_build_object(
    'marked_readonly', to_jsonb(v_readonly_ids),
    'marked_pending_delete', to_jsonb(v_pending_ids)
  );
end;
$$;

revoke all on function public.run_clinic_lifecycle_transitions() from public, anon, authenticated;
grant execute on function public.run_clinic_lifecycle_transitions() to service_role;

-- Hard delete refuses demo clinics
create or replace function public.hard_delete_clinic(p_clinic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'storage', 'auth'
as $$
declare
  v_user_ids uuid[] := '{}';
  v_storage_deleted int := 0;
  v_status public.clinic_status;
  v_is_demo boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select status, is_demo into v_status, v_is_demo
  from public.clinics
  where id = p_clinic_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if v_is_demo then
    raise exception 'demo_clinic';
  end if;

  if v_status <> 'pending_delete'::public.clinic_status then
    raise exception 'not_pending_delete';
  end if;

  select coalesce(array_agg(id), '{}') into v_user_ids
  from public.profiles
  where clinic_id = p_clinic_id;

  delete from storage.objects
  where (storage.foldername(name))[1] = p_clinic_id::text;
  get diagnostics v_storage_deleted = row_count;

  insert into public.audit_events (
    clinic_id, actor_user_id, event_name, payload_json
  ) values (
    null,
    null,
    'clinic.hard_deleted',
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'users_deleted', coalesce(cardinality(v_user_ids), 0),
      'storage_objects_deleted', v_storage_deleted
    )
  );

  delete from public.clinics where id = p_clinic_id;

  if cardinality(v_user_ids) > 0 then
    delete from auth.users where id = any (v_user_ids);
  end if;

  return jsonb_build_object(
    'ok', true,
    'clinic_id', p_clinic_id,
    'users_deleted', coalesce(cardinality(v_user_ids), 0),
    'storage_objects_deleted', v_storage_deleted
  );
end;
$$;

revoke all on function public.hard_delete_clinic(uuid) from public, anon, authenticated;
grant execute on function public.hard_delete_clinic(uuid) to service_role;
