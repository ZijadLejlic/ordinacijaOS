-- P2.2 / D-20 / FIN-RLS-001: finance `*_owner_mfa_aal2` policies were PERMISSIVE
-- FOR ALL. Postgres OR-semantics mean one matching permissive policy is enough,
-- so accountant (owner_mfa_ok() → true for non-owners) could DELETE/UPDATE
-- payments and invoice_lines despite "append-only: no UPDATE/DELETE policy"
-- comments in phase2d. Same hole on invoices / payment_plans /
-- payment_plan_installments (no named DELETE policy).
--
-- Fix (match expenses / patients pattern):
--   1. Flip all five finance MFA policies to RESTRICTIVE — they only narrow
--      existing SELECT/INSERT/UPDATE policies; they no longer grant ALL.
--   2. Defense in depth on truly append-only tables: REVOKE UPDATE, DELETE
--      from anon/authenticated (service_role + SECURITY DEFINER GDPR path
--      still work).

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
drop policy if exists invoices_owner_mfa_aal2 on public.invoices;
create policy invoices_owner_mfa_aal2
on public.invoices
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- ---------------------------------------------------------------------------
-- invoice_lines (append-only)
-- ---------------------------------------------------------------------------
drop policy if exists invoice_lines_owner_mfa_aal2 on public.invoice_lines;
create policy invoice_lines_owner_mfa_aal2
on public.invoice_lines
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

revoke update, delete on public.invoice_lines from anon, authenticated;

-- ---------------------------------------------------------------------------
-- payments (append-only)
-- ---------------------------------------------------------------------------
drop policy if exists payments_owner_mfa_aal2 on public.payments;
create policy payments_owner_mfa_aal2
on public.payments
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

revoke update, delete on public.payments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- payment_plans
-- ---------------------------------------------------------------------------
drop policy if exists payment_plans_owner_mfa_aal2 on public.payment_plans;
create policy payment_plans_owner_mfa_aal2
on public.payment_plans
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());

-- ---------------------------------------------------------------------------
-- payment_plan_installments
-- ---------------------------------------------------------------------------
drop policy if exists payment_plan_installments_owner_mfa_aal2 on public.payment_plan_installments;
create policy payment_plan_installments_owner_mfa_aal2
on public.payment_plan_installments
as restrictive
for all
to authenticated
using (owner_mfa_ok())
with check (owner_mfa_ok());
