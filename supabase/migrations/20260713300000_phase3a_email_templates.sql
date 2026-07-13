-- Faza 3A — Email templates + outbound messages (PRD §6.9 / D23).
-- Default BS/EN appointment_reminder; clinic edits text; Resend send via app.
-- RBAC: owner write templates; owner+reception read + send (PRD §3.2).
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase3a_email_templates

create or replace function public.can_read_email_templates()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'reception'::public.app_role
  );
$$;

create or replace function public.can_write_email_templates()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) = 'owner'::public.app_role;
$$;

create or replace function public.can_send_outbound_messages()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'reception'::public.app_role
  );
$$;

revoke all on function public.can_read_email_templates() from public, anon;
revoke all on function public.can_write_email_templates() from public, anon;
revoke all on function public.can_send_outbound_messages() from public, anon;
grant execute on function public.can_read_email_templates() to authenticated;
grant execute on function public.can_write_email_templates() to authenticated;
grant execute on function public.can_send_outbound_messages() to authenticated;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  template_key text not null
    check (template_key = 'appointment_reminder'),
  locale text not null
    check (locale in ('bs', 'en')),
  subject text not null
    check (char_length(trim(subject)) > 0 and char_length(subject) <= 200),
  body_text text not null
    check (char_length(trim(body_text)) > 0 and char_length(body_text) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, template_key, locale)
);

create index if not exists email_templates_clinic_id_idx
  on public.email_templates (clinic_id);

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;

create policy email_templates_select
  on public.email_templates
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_read_email_templates())
  );

create policy email_templates_insert
  on public.email_templates
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_email_templates())
  );

create policy email_templates_update
  on public.email_templates
  for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_email_templates())
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_email_templates())
  );

create policy email_templates_owner_mfa_aal2
  on public.email_templates
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

revoke all on table public.email_templates from anon;
grant select, insert, update on table public.email_templates to authenticated;

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  channel text not null default 'email'
    check (channel = 'email'),
  template_key text not null,
  locale text not null
    check (locale in ('bs', 'en')),
  to_address text not null,
  subject text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid references public.patients (id) on delete set null,
  is_test boolean not null default false,
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists outbound_messages_clinic_created_idx
  on public.outbound_messages (clinic_id, created_at desc);

create index if not exists outbound_messages_appointment_idx
  on public.outbound_messages (appointment_id)
  where appointment_id is not null;

alter table public.outbound_messages enable row level security;

create policy outbound_messages_select
  on public.outbound_messages
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_send_outbound_messages())
  );

create policy outbound_messages_insert
  on public.outbound_messages
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_send_outbound_messages())
  );

create policy outbound_messages_update
  on public.outbound_messages
  for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_send_outbound_messages())
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_send_outbound_messages())
  );

create policy outbound_messages_owner_mfa_aal2
  on public.outbound_messages
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

revoke all on table public.outbound_messages from anon;
grant select, insert, update on table public.outbound_messages to authenticated;

create or replace function public.seed_default_email_templates(p_clinic_id uuid)
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

  insert into public.email_templates (clinic_id, template_key, locale, subject, body_text)
  values
    (
      p_clinic_id,
      'appointment_reminder',
      'bs',
      'Podsjetnik na termin — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nPodsjećamo Vas na zakazani termin:\nDatum: {{datum}}\nVrijeme: {{vrijeme}}\nDoktor: {{doktor}}\nUsluga: {{usluga}}\n\nOrdinacija: {{ordinacija}}\n\nSrdačan pozdrav'
    ),
    (
      p_clinic_id,
      'appointment_reminder',
      'en',
      'Appointment reminder — {{ordinacija}}',
      E'Dear {{ime}},\n\nThis is a reminder for your appointment:\nDate: {{datum}}\nTime: {{vrijeme}}\nDoctor: {{doktor}}\nService: {{usluga}}\n\nClinic: {{ordinacija}}\n\nKind regards'
    )
  on conflict (clinic_id, template_key, locale) do nothing;
end;
$$;

revoke all on function public.seed_default_email_templates(uuid) from public, anon;
grant execute on function public.seed_default_email_templates(uuid) to authenticated;

-- Seed existing clinics (idempotent)
select public.seed_default_email_templates(id) from public.clinics;

-- New clinics: seed on create (keeps phase2i onboarding settings_json)
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

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile already exists';
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
