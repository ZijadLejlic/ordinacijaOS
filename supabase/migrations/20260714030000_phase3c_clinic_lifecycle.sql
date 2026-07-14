-- Faza 3C-c — Trial expiry → readonly → pending_delete → hard delete (D6 / D45 / §9).
-- Applied via MCP as: phase3c_clinic_lifecycle
--
-- Flow:
--   active + trial/period expired → readonly (7-day grace, export still available)
--   readonly + grace_ends_at < now() → pending_delete
--   cron (service role) calls hard_delete_clinic for pending_delete rows

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists readonly_started_at timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists closure_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinics_closure_reason_check'
      and conrelid = 'public.clinics'::regclass
  ) then
    alter table public.clinics
      add constraint clinics_closure_reason_check
      check (
        closure_reason is null
        or closure_reason in ('trial_expired', 'owner_requested', 'unpaid')
      );
  end if;
end $$;

create index if not exists clinics_lifecycle_status_grace_idx
  on public.clinics (status, grace_ends_at)
  where status in ('readonly', 'pending_delete');

create index if not exists clinics_lifecycle_trial_idx
  on public.clinics (status, trial_ends_at)
  where status = 'active' and trial_ends_at is not null;

-- ---------------------------------------------------------------------------
-- Writable guard (blocks INSERT/UPDATE/DELETE while not active)
-- ---------------------------------------------------------------------------
create or replace function public.clinic_is_writable()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (
      select c.status = 'active'::public.clinic_status
      from public.clinics c
      where c.id = (select public.current_clinic_id())
    ),
    false
  );
$$;

revoke all on function public.clinic_is_writable() from public, anon;
grant execute on function public.clinic_is_writable() to authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'patients',
    'patient_allergies',
    'patient_documents',
    'patient_images',
    'odontogram_teeth',
    'odontogram_events',
    'treatment_plans',
    'treatment_plan_items',
    'services',
    'appointments',
    'appointment_waitlist',
    'invoices',
    'invoice_lines',
    'payments',
    'payment_plans',
    'payment_plan_installments',
    'expenses',
    'email_templates',
    'outbound_messages',
    'crm_notifications',
    'clinic_locations',
    'clinic_invites',
    'gdpr_erasure_requests'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists clinic_writable_insert on public.%I', t);
    execute format('drop policy if exists clinic_writable_update on public.%I', t);
    execute format('drop policy if exists clinic_writable_delete on public.%I', t);

    execute format(
      'create policy clinic_writable_insert on public.%I as restrictive for insert to authenticated with check ((select public.clinic_is_writable()))',
      t
    );
    execute format(
      'create policy clinic_writable_update on public.%I as restrictive for update to authenticated using ((select public.clinic_is_writable())) with check ((select public.clinic_is_writable()))',
      t
    );
    execute format(
      'create policy clinic_writable_delete on public.%I as restrictive for delete to authenticated using ((select public.clinic_is_writable()))',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Owner-initiated closure (export → 7d grace → hard delete)
-- ---------------------------------------------------------------------------
create or replace function public.request_clinic_closure()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_clinic_id uuid;
  v_grace timestamptz;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if not (select public.is_clinic_owner()) then
    raise exception 'forbidden';
  end if;

  if not (select public.owner_mfa_ok()) then
    raise exception 'mfa_required';
  end if;

  v_clinic_id := (select public.current_clinic_id());
  if v_clinic_id is null then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.clinics
    where id = v_clinic_id
      and status in ('readonly'::public.clinic_status, 'pending_delete'::public.clinic_status)
  ) then
    raise exception 'already_closing';
  end if;

  v_grace := now() + interval '7 days';

  update public.clinics
  set
    status = 'readonly'::public.clinic_status,
    readonly_started_at = now(),
    grace_ends_at = v_grace,
    closure_reason = 'owner_requested',
    updated_at = now()
  where id = v_clinic_id
    and status = 'active'::public.clinic_status;

  if not found then
    raise exception 'not_active';
  end if;

  update public.clinic_subscriptions
  set status = 'readonly'::public.subscription_status, updated_at = now()
  where clinic_id = v_clinic_id
    and status in (
      'trial'::public.subscription_status,
      'active'::public.subscription_status,
      'past_due'::public.subscription_status
    );

  insert into public.audit_events (
    clinic_id, actor_user_id, event_name, payload_json
  ) values (
    v_clinic_id,
    v_uid,
    'clinic.closure_requested',
    jsonb_build_object(
      'grace_ends_at', v_grace,
      'reason', 'owner_requested'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'readonly',
    'grace_ends_at', v_grace
  );
end;
$$;

revoke all on function public.request_clinic_closure() from public, anon;
grant execute on function public.request_clinic_closure() to authenticated;

-- ---------------------------------------------------------------------------
-- Daily lifecycle transitions (service_role only)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Hard delete clinic + storage + auth users (service_role only)
-- ---------------------------------------------------------------------------
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
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select status into v_status
  from public.clinics
  where id = p_clinic_id
  for update;

  if not found then
    raise exception 'not_found';
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
