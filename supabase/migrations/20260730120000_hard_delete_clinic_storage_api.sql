-- Hard delete must not DELETE storage.objects via SQL.
-- Supabase blocks that with protect_objects_delete (42501) unless
-- storage.allow_delete_query is set; even with the flag, SQL delete orphans
-- provider blobs. App layer (lifecycle job / cleanupClinics) removes objects
-- via the Storage API before calling this RPC.

create or replace function public.hard_delete_clinic(p_clinic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_user_ids uuid[] := '{}';
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

  insert into public.audit_events (
    clinic_id, actor_user_id, event_name, payload_json
  ) values (
    null,
    null,
    'clinic.hard_deleted',
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'users_deleted', coalesce(cardinality(v_user_ids), 0),
      'storage_objects_deleted', 0
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
    'storage_objects_deleted', 0
  );
end;
$$;

revoke all on function public.hard_delete_clinic(uuid) from public, anon, authenticated;
grant execute on function public.hard_delete_clinic(uuid) to service_role;
