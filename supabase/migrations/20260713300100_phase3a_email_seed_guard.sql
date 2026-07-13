-- Faza 3A follow-up — seed_default_email_templates membership guard.
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase3a_email_seed_guard
--
-- (Full function body lives in 20260713300000_phase3a_email_templates.sql
-- after merge; this file documents the remote history entry.)

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
