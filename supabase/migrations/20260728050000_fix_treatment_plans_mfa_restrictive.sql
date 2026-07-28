-- TEN-RLS-012 / TEN-SEC-002: treatment_plans(+items) MFA policies were
-- PERMISSIVE FOR ALL (phase2b matched a remote dump for P0.1). Postgres
-- OR-semantics mean one matching permissive policy is enough, so any
-- non-owner (owner_mfa_ok() → true) could SELECT/INSERT every clinic's
-- treatment plans — bypassing clinic_id = current_clinic_id().
--
-- Same class of bug as D-20 / FIN-RLS-001 on finance tables. Fix: flip to
-- RESTRICTIVE so MFA only narrows the clinical SELECT/INSERT policies.

drop policy if exists treatment_plans_owner_mfa_aal2 on public.treatment_plans;
create policy treatment_plans_owner_mfa_aal2
on public.treatment_plans
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

drop policy if exists treatment_plan_items_owner_mfa_aal2 on public.treatment_plan_items;
create policy treatment_plan_items_owner_mfa_aal2
on public.treatment_plan_items
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());
