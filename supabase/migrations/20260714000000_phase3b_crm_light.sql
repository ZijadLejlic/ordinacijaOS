-- Faza 3B — CRM light notifications (PRD §6.10 / D24).
-- In-app inbox: birthday / recall / control; reception explicitly sends email.
-- Reuses email_templates + outbound_messages (extends template_key check).
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase3b_crm_light

-- ---------------------------------------------------------------------------
-- patients.next_control_at
-- ---------------------------------------------------------------------------
alter table public.patients
  add column if not exists next_control_at date;

create index if not exists patients_clinic_next_control_idx
  on public.patients (clinic_id, next_control_at)
  where next_control_at is not null;

-- ---------------------------------------------------------------------------
-- CRM RBAC helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_access_crm()
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

revoke all on function public.can_access_crm() from public, anon;
grant execute on function public.can_access_crm() to authenticated;

-- ---------------------------------------------------------------------------
-- crm_notifications
-- ---------------------------------------------------------------------------
create table if not exists public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind text not null
    check (kind in ('birthday', 'recall', 'control')),
  due_on date not null,
  status text not null default 'open'
    check (status in ('open', 'sent', 'dismissed')),
  outbound_message_id uuid references public.outbound_messages (id) on delete set null,
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_notifications_open_unique
  on public.crm_notifications (clinic_id, patient_id, kind, due_on)
  where status = 'open';

create index if not exists crm_notifications_clinic_status_idx
  on public.crm_notifications (clinic_id, status, due_on);

create index if not exists crm_notifications_patient_idx
  on public.crm_notifications (patient_id);

create trigger crm_notifications_set_updated_at
  before update on public.crm_notifications
  for each row execute function public.set_updated_at();

alter table public.crm_notifications enable row level security;

create policy crm_notifications_select
  on public.crm_notifications
  for select
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_access_crm())
  );

create policy crm_notifications_insert
  on public.crm_notifications
  for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_access_crm())
  );

create policy crm_notifications_update
  on public.crm_notifications
  for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_access_crm())
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_access_crm())
  );

create policy crm_notifications_owner_mfa_aal2
  on public.crm_notifications
  as restrictive
  for all
  to authenticated
  using ((select public.owner_mfa_ok()))
  with check ((select public.owner_mfa_ok()));

revoke all on table public.crm_notifications from anon;
grant select, insert, update on table public.crm_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Widen email_templates.template_key for CRM templates
-- ---------------------------------------------------------------------------
alter table public.email_templates
  drop constraint if exists email_templates_template_key_check;

alter table public.email_templates
  add constraint email_templates_template_key_check
  check (
    template_key in (
      'appointment_reminder',
      'birthday',
      'recall',
      'control'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed defaults (appointment_reminder + CRM keys)
-- ---------------------------------------------------------------------------
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
    ),
    (
      p_clinic_id,
      'birthday',
      'bs',
      'Sretan rođendan — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nČestitamo Vam rođendan ({{datum}})!\n\nVaša {{ordinacija}} Vam želi sve najbolje.\n\nSrdačan pozdrav'
    ),
    (
      p_clinic_id,
      'birthday',
      'en',
      'Happy birthday — {{ordinacija}}',
      E'Dear {{ime}},\n\nHappy birthday ({{datum}})!\n\nYour clinic {{ordinacija}} wishes you all the best.\n\nKind regards'
    ),
    (
      p_clinic_id,
      'recall',
      'bs',
      'Podsjetnik za kontrolni pregled — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nProšlo je vrijeme za redovni stomatološki pregled.\nPredlažemo da zakažete termin u {{ordinacija}}.\n\nSrdačan pozdrav'
    ),
    (
      p_clinic_id,
      'recall',
      'en',
      'Time for a check-up — {{ordinacija}}',
      E'Dear {{ime}},\n\nIt has been a while since your last dental visit.\nWe recommend booking an appointment at {{ordinacija}}.\n\nKind regards'
    ),
    (
      p_clinic_id,
      'control',
      'bs',
      'Podsjetnik na kontrolu — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nPodsjećamo Vas na zakazanu kontrolu ({{datum}}).\nMolimo da kontaktirate {{ordinacija}} radi termina.\n\nSrdačan pozdrav'
    ),
    (
      p_clinic_id,
      'control',
      'en',
      'Follow-up reminder — {{ordinacija}}',
      E'Dear {{ime}},\n\nThis is a reminder about your follow-up visit ({{datum}}).\nPlease contact {{ordinacija}} to schedule.\n\nKind regards'
    )
  on conflict (clinic_id, template_key, locale) do nothing;
end;
$$;

revoke all on function public.seed_default_email_templates(uuid) from public, anon;
grant execute on function public.seed_default_email_templates(uuid) to authenticated;

-- Backfill CRM templates for existing clinics (service-role / migration context:
-- seed requires auth.uid membership; use direct insert for migration backfill)
insert into public.email_templates (clinic_id, template_key, locale, subject, body_text)
select
  c.id,
  v.template_key,
  v.locale,
  v.subject,
  v.body_text
from public.clinics c
cross join (
  values
    (
      'birthday',
      'bs',
      'Sretan rođendan — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nČestitamo Vam rođendan ({{datum}})!\n\nVaša {{ordinacija}} Vam želi sve najbolje.\n\nSrdačan pozdrav'
    ),
    (
      'birthday',
      'en',
      'Happy birthday — {{ordinacija}}',
      E'Dear {{ime}},\n\nHappy birthday ({{datum}})!\n\nYour clinic {{ordinacija}} wishes you all the best.\n\nKind regards'
    ),
    (
      'recall',
      'bs',
      'Podsjetnik za kontrolni pregled — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nProšlo je vrijeme za redovni stomatološki pregled.\nPredlažemo da zakažete termin u {{ordinacija}}.\n\nSrdačan pozdrav'
    ),
    (
      'recall',
      'en',
      'Time for a check-up — {{ordinacija}}',
      E'Dear {{ime}},\n\nIt has been a while since your last dental visit.\nWe recommend booking an appointment at {{ordinacija}}.\n\nKind regards'
    ),
    (
      'control',
      'bs',
      'Podsjetnik na kontrolu — {{ordinacija}}',
      E'Poštovani/a {{ime}},\n\nPodsjećamo Vas na zakazanu kontrolu ({{datum}}).\nMolimo da kontaktirate {{ordinacija}} radi termina.\n\nSrdačan pozdrav'
    ),
    (
      'control',
      'en',
      'Follow-up reminder — {{ordinacija}}',
      E'Dear {{ime}},\n\nThis is a reminder about your follow-up visit ({{datum}}).\nPlease contact {{ordinacija}} to schedule.\n\nKind regards'
    )
) as v(template_key, locale, subject, body_text)
on conflict (clinic_id, template_key, locale) do nothing;
