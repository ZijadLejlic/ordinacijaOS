-- Faza 3C-b — GDPR erasure requests + hard delete RPC (PRD D35 / §8.2).
-- Applied via MCP as: phase3c_gdpr_erasure
-- Depends on: phase3c_audit_log_ui (owner-only audit SELECT)

create table if not exists public.gdpr_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  patient_snapshot jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'rejected', 'completed', 'failed')),
  rejection_reason text,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gdpr_erasure_requests_clinic_status_idx
  on public.gdpr_erasure_requests (clinic_id, status, created_at desc);

create unique index if not exists gdpr_erasure_requests_pending_patient_idx
  on public.gdpr_erasure_requests (clinic_id, patient_id)
  where status = 'pending' and patient_id is not null;

create trigger gdpr_erasure_requests_set_updated_at
  before update on public.gdpr_erasure_requests
  for each row execute function public.set_updated_at();

alter table public.gdpr_erasure_requests enable row level security;

create policy gdpr_erasure_select_clinic
  on public.gdpr_erasure_requests
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_patients())
  );

create policy gdpr_erasure_insert_clinic
  on public.gdpr_erasure_requests
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and requested_by = (select auth.uid())
    and (select public.can_write_patients())
  );

create policy gdpr_erasure_update_owner
  on public.gdpr_erasure_requests
  for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.is_clinic_owner())
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.is_clinic_owner())
  );

create policy gdpr_erasure_owner_mfa_aal2
  on public.gdpr_erasure_requests
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

grant select, insert, update on public.gdpr_erasure_requests to authenticated;

create or replace function public.approve_gdpr_patient_erasure(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_clinic_id uuid;
  v_patient_id uuid;
  v_request public.gdpr_erasure_requests%rowtype;
  v_invoice_ids uuid[];
  v_plan_ids uuid[];
  v_deleted_docs int := 0;
  v_deleted_images int := 0;
  v_deleted_invoices int := 0;
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

  select * into v_request
  from public.gdpr_erasure_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if v_request.clinic_id is distinct from (select public.current_clinic_id()) then
    raise exception 'forbidden';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  if v_request.patient_id is null then
    raise exception 'patient_missing';
  end if;

  v_clinic_id := v_request.clinic_id;
  v_patient_id := v_request.patient_id;

  select coalesce(array_agg(id), '{}') into v_invoice_ids
  from public.invoices
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  select coalesce(array_agg(id), '{}') into v_plan_ids
  from public.payment_plans
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  if cardinality(v_plan_ids) > 0 then
    delete from public.payment_plan_installments
    where payment_plan_id = any (v_plan_ids);
    delete from public.payment_plans
    where id = any (v_plan_ids);
  end if;

  if cardinality(v_invoice_ids) > 0 then
    delete from public.payments
    where invoice_id = any (v_invoice_ids);
    delete from public.invoice_lines
    where invoice_id = any (v_invoice_ids);
    delete from public.invoices
    where id = any (v_invoice_ids);
    v_deleted_invoices := cardinality(v_invoice_ids);
  end if;

  delete from public.crm_notifications
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  update public.outbound_messages
  set patient_id = null
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.appointment_waitlist
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.appointments
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.treatment_plan_items
  where treatment_plan_id in (
    select id from public.treatment_plans
    where clinic_id = v_clinic_id and patient_id = v_patient_id
  );

  delete from public.treatment_plans
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.odontogram_events
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.odontogram_teeth
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.patient_allergies
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  select count(*)::int into v_deleted_docs
  from public.patient_documents
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.patient_documents
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  select count(*)::int into v_deleted_images
  from public.patient_images
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.patient_images
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.patients
  where id = v_patient_id and clinic_id = v_clinic_id;

  update public.gdpr_erasure_requests
  set
    status = 'completed',
    patient_id = null,
    completed_at = now(),
    approved_by = v_uid,
    approved_at = now(),
    error_message = null
  where id = p_request_id;

  insert into public.audit_events (
    clinic_id, actor_user_id, event_name, payload_json
  ) values (
    v_clinic_id,
    v_uid,
    'gdpr.patient_erased',
    jsonb_build_object(
      'request_id', p_request_id,
      'patient_id', v_patient_id,
      'documents_deleted', v_deleted_docs,
      'images_deleted', v_deleted_images,
      'invoices_deleted', v_deleted_invoices
    )
  );

  return jsonb_build_object(
    'ok', true,
    'patient_id', v_patient_id,
    'documents_deleted', v_deleted_docs,
    'images_deleted', v_deleted_images,
    'invoices_deleted', v_deleted_invoices
  );
end;
$$;

revoke all on function public.approve_gdpr_patient_erasure(uuid) from public, anon;
grant execute on function public.approve_gdpr_patient_erasure(uuid) to authenticated;
