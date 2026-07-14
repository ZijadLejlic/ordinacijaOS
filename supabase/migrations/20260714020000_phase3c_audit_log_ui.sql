-- Faza 3C-a — Audit log owner-only SELECT (PRD §6.15).
-- Applied via MCP as: phase3c_audit_log_ui

drop policy if exists audit_events_select_member on public.audit_events;

create policy audit_events_select_owner
on public.audit_events
for select
to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.is_clinic_owner())
);

create index if not exists audit_events_clinic_created_idx
  on public.audit_events (clinic_id, created_at desc);
