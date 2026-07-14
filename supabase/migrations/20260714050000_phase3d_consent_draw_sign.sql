-- Faza 3D — Consent draw-sign + doc templates (PRD §6.11 / D20).
-- consent_forms = clinic document templates (BS/EN); consent_signatures = signed PDFs.
-- Feature gate: consent_draw_sign (Pro+). Storage: patient-files private bucket.
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase3d_consent_draw_sign

-- ---------------------------------------------------------------------------
-- RBAC helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_read_consent_forms()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'doctor'::public.app_role,
    'assistant'::public.app_role,
    'reception'::public.app_role
  );
$$;

create or replace function public.can_write_consent_forms()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) = 'owner'::public.app_role;
$$;

create or replace function public.can_sign_consents()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.can_write_patients());
$$;

revoke all on function public.can_read_consent_forms() from public, anon;
revoke all on function public.can_write_consent_forms() from public, anon;
revoke all on function public.can_sign_consents() from public, anon;
grant execute on function public.can_read_consent_forms() to authenticated;
grant execute on function public.can_write_consent_forms() to authenticated;
grant execute on function public.can_sign_consents() to authenticated;

-- ---------------------------------------------------------------------------
-- consent_forms (templates)
-- ---------------------------------------------------------------------------

create table if not exists public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  template_key text not null
    check (template_key in (
      'general_treatment',
      'data_processing',
      'radiography'
    )),
  locale text not null
    check (locale in ('bs', 'en')),
  title text not null
    check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  body_text text not null
    check (char_length(trim(body_text)) > 0 and char_length(body_text) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, template_key, locale)
);

create index if not exists consent_forms_clinic_id_idx
  on public.consent_forms (clinic_id);

create trigger consent_forms_set_updated_at
  before update on public.consent_forms
  for each row execute function public.set_updated_at();

alter table public.consent_forms enable row level security;

create policy consent_forms_select
  on public.consent_forms
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_read_consent_forms())
  );

create policy consent_forms_insert
  on public.consent_forms
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_consent_forms())
  );

create policy consent_forms_update
  on public.consent_forms
  for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_consent_forms())
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_consent_forms())
  );

create policy consent_forms_owner_mfa_aal2
  on public.consent_forms
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

create policy clinic_writable_insert
  on public.consent_forms
  as restrictive
  for insert
  to authenticated
  with check ((select public.clinic_is_writable()));

create policy clinic_writable_update
  on public.consent_forms
  as restrictive
  for update
  to authenticated
  using ((select public.clinic_is_writable()))
  with check ((select public.clinic_is_writable()));

create policy clinic_writable_delete
  on public.consent_forms
  as restrictive
  for delete
  to authenticated
  using ((select public.clinic_is_writable()));

revoke all on table public.consent_forms from anon;
grant select, insert, update on table public.consent_forms to authenticated;

-- ---------------------------------------------------------------------------
-- consent_signatures (signed instances)
-- ---------------------------------------------------------------------------

create table if not exists public.consent_signatures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  consent_form_id uuid not null references public.consent_forms (id) on delete restrict,
  template_key text not null
    check (template_key in (
      'general_treatment',
      'data_processing',
      'radiography'
    )),
  locale text not null
    check (locale in ('bs', 'en')),
  title text not null
    check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  body_rendered text not null
    check (char_length(trim(body_rendered)) > 0 and char_length(body_rendered) <= 20000),
  signature_storage_path text not null unique,
  pdf_storage_path text not null unique,
  signed_at timestamptz not null default now(),
  signed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consent_signatures_clinic_patient_idx
  on public.consent_signatures (clinic_id, patient_id, signed_at desc);

create index if not exists consent_signatures_form_idx
  on public.consent_signatures (consent_form_id);

alter table public.consent_signatures enable row level security;

create policy consent_signatures_select
  on public.consent_signatures
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_read_consent_forms())
  );

create policy consent_signatures_insert
  on public.consent_signatures
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_sign_consents())
  );

create policy consent_signatures_delete
  on public.consent_signatures
  for delete
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_sign_consents())
  );

create policy consent_signatures_owner_mfa_aal2
  on public.consent_signatures
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

create policy clinic_writable_insert
  on public.consent_signatures
  as restrictive
  for insert
  to authenticated
  with check ((select public.clinic_is_writable()));

create policy clinic_writable_update
  on public.consent_signatures
  as restrictive
  for update
  to authenticated
  using ((select public.clinic_is_writable()))
  with check ((select public.clinic_is_writable()));

create policy clinic_writable_delete
  on public.consent_signatures
  as restrictive
  for delete
  to authenticated
  using ((select public.clinic_is_writable()));

revoke all on table public.consent_signatures from anon;
grant select, insert, delete on table public.consent_signatures to authenticated;

-- ---------------------------------------------------------------------------
-- Seed defaults
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_consent_forms(p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.clinic_id = p_clinic_id
      and p.is_active = true
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.consent_forms (clinic_id, template_key, locale, title, body_text)
  values
    (
      p_clinic_id,
      'general_treatment',
      'bs',
      'Opća saglasnost za stomatološki tretman',
      E'Ja, {{ime}}, dajem saglasnost ordinaciji {{ordinacija}} da izvrši stomatološki pregled i dogovorene tretmane.\n\nObaviješten/a sam o prirodi tretmana, mogućim rizicima i alternativama. Imam pravo da postavim pitanja i da povučem saglasnost prije zahvata.\n\nDatum: {{datum}}'
    ),
    (
      p_clinic_id,
      'general_treatment',
      'en',
      'General dental treatment consent',
      E'I, {{ime}}, consent to dental examination and agreed treatments at {{ordinacija}}.\n\nI have been informed about the nature of treatment, possible risks, and alternatives. I may ask questions and withdraw consent before the procedure.\n\nDate: {{datum}}'
    ),
    (
      p_clinic_id,
      'data_processing',
      'bs',
      'Saglasnost za obradu ličnih podataka',
      E'Ja, {{ime}}, dajem saglasnost ordinaciji {{ordinacija}} za obradu mojih ličnih i zdravstvenih podataka u svrhu pružanja stomatološke zdravstvene zaštite, vođenja kartona i zakonskih obaveza.\n\nUpoznat/a sam da mogu zatražiti uvid, ispravku ili brisanje podataka u skladu sa važećim propisima.\n\nDatum: {{datum}}'
    ),
    (
      p_clinic_id,
      'data_processing',
      'en',
      'Consent to personal data processing',
      E'I, {{ime}}, consent to {{ordinacija}} processing my personal and health data for dental care, medical records, and legal obligations.\n\nI understand I may request access, correction, or erasure of my data as provided by applicable law.\n\nDate: {{datum}}'
    ),
    (
      p_clinic_id,
      'radiography',
      'bs',
      'Saglasnost za RTG snimanje',
      E'Ja, {{ime}}, dajem saglasnost ordinaciji {{ordinacija}} za izradu potrebnih rendgenskih snimaka u dijagnostičke i terapijske svrhe.\n\nObaviješten/a sam o razlozima snimanja i zaštitnim mjerama.\n\nDatum: {{datum}}'
    ),
    (
      p_clinic_id,
      'radiography',
      'en',
      'Consent to dental radiography',
      E'I, {{ime}}, consent to {{ordinacija}} taking necessary dental radiographs for diagnostic and treatment purposes.\n\nI have been informed about the reasons for imaging and protective measures.\n\nDate: {{datum}}'
    )
  on conflict (clinic_id, template_key, locale) do nothing;
end;
$$;

revoke all on function public.seed_default_consent_forms(uuid) from public, anon;
grant execute on function public.seed_default_consent_forms(uuid) to authenticated;

-- Seed existing clinics (service role / migration context has no auth.uid —
-- insert directly for backfill; RPC remains for app lazy-seed).
insert into public.consent_forms (clinic_id, template_key, locale, title, body_text)
select
  c.id,
  v.template_key,
  v.locale,
  v.title,
  v.body_text
from public.clinics c
cross join (
  values
    (
      'general_treatment',
      'bs',
      'Opća saglasnost za stomatološki tretman',
      E'Ja, {{ime}}, dajem saglasnost ordinaciji {{ordinacija}} da izvrši stomatološki pregled i dogovorene tretmane.\n\nObaviješten/a sam o prirodi tretmana, mogućim rizicima i alternativama. Imam pravo da postavim pitanja i da povučem saglasnost prije zahvata.\n\nDatum: {{datum}}'
    ),
    (
      'general_treatment',
      'en',
      'General dental treatment consent',
      E'I, {{ime}}, consent to dental examination and agreed treatments at {{ordinacija}}.\n\nI have been informed about the nature of treatment, possible risks, and alternatives. I may ask questions and withdraw consent before the procedure.\n\nDate: {{datum}}'
    ),
    (
      'data_processing',
      'bs',
      'Saglasnost za obradu ličnih podataka',
      E'Ja, {{ime}}, dajem saglasnost ordinaciji {{ordinacija}} za obradu mojih ličnih i zdravstvenih podataka u svrhu pružanja stomatološke zdravstvene zaštite, vođenja kartona i zakonskih obaveza.\n\nUpoznat/a sam da mogu zatražiti uvid, ispravku ili brisanje podataka u skladu sa važećim propisima.\n\nDatum: {{datum}}'
    ),
    (
      'data_processing',
      'en',
      'Consent to personal data processing',
      E'I, {{ime}}, consent to {{ordinacija}} processing my personal and health data for dental care, medical records, and legal obligations.\n\nI understand I may request access, correction, or erasure of my data as provided by applicable law.\n\nDate: {{datum}}'
    ),
    (
      'radiography',
      'bs',
      'Saglasnost za RTG snimanje',
      E'Ja, {{ime}}, dajem saglasnost ordinaciji {{ordinacija}} za izradu potrebnih rendgenskih snimaka u dijagnostičke i terapijske svrhe.\n\nObaviješten/a sam o razlozima snimanja i zaštitnim mjerama.\n\nDatum: {{datum}}'
    ),
    (
      'radiography',
      'en',
      'Consent to dental radiography',
      E'I, {{ime}}, consent to {{ordinacija}} taking necessary dental radiographs for diagnostic and treatment purposes.\n\nI have been informed about the reasons for imaging and protective measures.\n\nDate: {{datum}}'
    )
) as v(template_key, locale, title, body_text)
on conflict (clinic_id, template_key, locale) do nothing;

-- ---------------------------------------------------------------------------
-- Hook into clinic create
-- ---------------------------------------------------------------------------

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
  perform public.seed_default_consent_forms(v_clinic_id);

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

-- ---------------------------------------------------------------------------
-- GDPR hard delete: remove consent_signatures before patients
-- ---------------------------------------------------------------------------

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
  v_deleted_consents int := 0;
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

  select count(*)::int into v_deleted_consents
  from public.consent_signatures
  where clinic_id = v_clinic_id and patient_id = v_patient_id;

  delete from public.consent_signatures
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
      'invoices_deleted', v_deleted_invoices,
      'consents_deleted', v_deleted_consents
    )
  );

  return jsonb_build_object(
    'ok', true,
    'patient_id', v_patient_id,
    'documents_deleted', v_deleted_docs,
    'images_deleted', v_deleted_images,
    'invoices_deleted', v_deleted_invoices,
    'consents_deleted', v_deleted_consents
  );
end;
$$;

revoke all on function public.approve_gdpr_patient_erasure(uuid) from public, anon;
grant execute on function public.approve_gdpr_patient_erasure(uuid) to authenticated;
