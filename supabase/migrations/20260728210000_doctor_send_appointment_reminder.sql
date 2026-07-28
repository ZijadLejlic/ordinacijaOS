-- D52: Doctors may send appointment reminders for their own calendar.
-- Template edit stays owner-only; settings UI stays owner+reception (app RBAC).
-- RLS read on email_templates expanded so doctor SA can load the clinic template.
-- CRM send remains gated by app RBAC (canSendCrmMessages), not this helper alone.

create or replace function public.can_read_email_templates()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select public.current_app_role()) in (
    'owner'::public.app_role,
    'reception'::public.app_role,
    'doctor'::public.app_role
  );
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
    'reception'::public.app_role,
    'doctor'::public.app_role
  );
$$;
