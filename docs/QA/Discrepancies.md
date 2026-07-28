# DentOrd — PRD / Tech / DB vs Code Discrepancies

> Verified against the repository on 2026-07-23. Do **not** assume PRD checkboxes imply automated coverage.
> Each finding: evidence (path), impact, recommended test(s), suggested product/tech resolution.

Related: [Traceability-Matrix.md](./Traceability-Matrix.md) §10, [Threat-Model.md](./Threat-Model.md) §6, [Implementation-Plan.md](./Implementation-Plan.md) P0–P1.

---

## 1. Severity legend

| Sev | Meaning |
|---|---|
| **S0** | Blocks hermetic testing or creates Critical security residual |
| **S1** | PRD requirement partially unmet or enforceable only in app |
| **S2** | Wording / UX / docs mismatch; behavior is intentional or minor |
| **S3** | Process / ops / future scope |

---

## 2. Findings

### D-01 — Schema not reproducible from local migrations (S0) — **RESOLVED 2026-07-23**

**Evidence (original)**

- Phase 1 foundation applied only on remote (documented in [`docs/DB-OrdinacijaOS.md`](../DB-OrdinacijaOS.md) §10).
- Multiple phase 2 files are **stubs**, e.g. [`supabase/migrations/20260713210000_phase2a_clinical_core.sql`](../../supabase/migrations/20260713210000_phase2a_clinical_core.sql) lines 1–26 (“local stub… To regenerate… `supabase db diff`”).
- Same pattern: `phase2b_treatment_plans.sql`, `phase2c_appointments.sql`, `phase2d_invoices.sql`, `phase2e_expenses.sql`.

**Impact**

- `supabase db reset` cannot recreate production schema → hermetic RLS/DB CI blocked.
- New contributors / CI cannot verify migrations independently of the live project.

**Catching tests / work**

- P0.1: dump remote schema into real SQL migrations; `supabase db reset` smoke in CI (P0.7).
- Test ID: harness prerequisite for all `*-RLS-*` / `*-DB-*`.

**Resolution — done (2026-07-23)**

- Added [`supabase/migrations/20260712900001_phase1_foundation.sql`](../../supabase/migrations/20260712900001_phase1_foundation.sql): extensions, 4 Phase-1 enums, all 9 Phase-1 tables, RBAC bootstrap helpers (`current_clinic_id`/`current_app_role`/`is_clinic_owner`/`owner_mfa_ok` — bootstrap form later superseded by `CREATE OR REPLACE` in `20260713000006_code_review_b5_jwt_custom_claims.sql`), 14 handoff functions + triggers + `rls_auto_enable` event trigger + baseline RLS policy names.
- Replaced stub content in `phase2a_clinical_core.sql`, `phase2b_treatment_plans.sql`, `phase2c_appointments.sql`, `phase2d_invoices.sql`, `phase2e_expenses.sql` with full executable SQL (tables/enums/functions/triggers/RLS/storage), matching the remote schema.
- **Bug fix found and fixed in the same pass**: `20260713000005_code_review_b4_rls_performance.sql` had a syntax error — `with_check (` instead of valid Postgres `with check (` — 18 occurrences, would have blocked `supabase db reset` outright regardless of the stub issue above.
- **Verified read-only via Supabase MCP `execute_sql`** against the remote project (zero DDL sent to remote): 67/67 function names, 35/35 tables, 14/14 enums match exactly; `pg_policies.permissive` cross-checked for all `owner_mfa_aal2` policies (PERMISSIVE on treatment_plans/treatment_plan_items/invoices/invoice_lines/payments/payment_plans/payment_plan_installments, RESTRICTIVE on appointments/appointment_waitlist/expenses/patients — matches implementation); 11 storage.objects policy names match; `invoice_lines.vat_rate numeric(5,4)` vs `services.vat_rate numeric(5,2)` confirmed and correctly implemented as different scales.
- **Residual gap (now closed)**: local dev sandbox still has no Docker/Colima/Podman (`docker not found`), so `supabase db reset` cannot be run from *this* environment. That is expected/permanent for this sandbox, not a product gap.
- **P0.7 update (2026-07-23)**: [`.github/workflows/security.yml`](../../.github/workflows/security.yml) runs exactly this `supabase start` / `supabase db reset` sequence (plus `test:security`) on every PR/push on a real GitHub Actions runner (which has Docker).
- **Live verification (2026-07-23, closes the residual)**: confirmed via `gh run view <run-id> --log` on the latest green run on `main` (commit `37a4927`, run [`30048179856`](https://github.com/ZijadLejlic/ordinacijaOS/actions/runs/30048179856)) — job **"Tenant isolation & RBAC (local Supabase)"** log shows, in order: `Run supabase start` → `Seeding data from supabase/seed.sql...` → `Started supabase local development setup.` → `Run supabase db reset` → `Seeding data from supabase/seed.sql...` → `Finished supabase db reset on branch main.` → `Run npm run test:security` with `SECURITY_TESTS_REQUIRED: 1` → `Test Files 2 passed (2)` / `Tests 21 passed (21)`. Workflow conclusion: `success`. This is the actual Docker-enabled `supabase db reset` E2E run the plan required — no longer just syntax-reviewed.

**Verification command (proven green in CI; requires Docker locally to reproduce outside CI)**

```bash
supabase start
supabase db reset
```

---

### D-02 — Image limit (D22) enforced only in app (S0) — **RESOLVED 2026-07-28**

**Evidence (pre-fix)**

- Helper: [`lib/entitlements/limits.ts`](../../lib/entitlements/limits.ts) `assertCanAddPatientImage`.
- Called from [`lib/patients/actions.ts`](../../lib/patients/actions.ts) (~line 557) before upload.
- Unit coverage: [`lib/entitlements/entitlements.test.ts`](../../lib/entitlements/entitlements.test.ts).
- P1.6 probe (`FILE-DB-001`) confirmed direct PostgREST INSERT past cap succeeded (DB had no gate).

**Impact (pre-fix)**

- Authenticated user who can INSERT `patient_images` could exceed plan cap by bypassing the Server Action.
- PRD D8/D22 “hard block” was soft at the database boundary.

**Catching tests**

- `FILE-DB-001` (now asserts DB deny via `plan_limit_images`), `PLAN-INT-002`.

**Resolution**

- **RESOLVED 2026-07-28 (P1.11 Option A):** BEFORE INSERT trigger `patient_images_enforce_limits` → `public.enforce_patient_image_limits()` in [`supabase/migrations/20260728000000_plan_limit_patient_images.sql`](../../supabase/migrations/20260728000000_plan_limit_patient_images.sql). Mirrors invite/location limit pattern; raises `plan_limit_images` (`check_violation`) when `count(patient_images) >= plans.limits_json.images_per_patient`. SA gate retained as defense-in-depth.

---

### D-03 — Feature entitlements (D42) enforced only in Server Actions (S0 residual) — **WAIVED for MVP 2026-07-28**

**Evidence**

- `assertFeature` in [`lib/entitlements/features.ts`](../../lib/entitlements/features.ts); used across `lib/*/actions.ts` (inventory, CRM, consent, expenses, branding, …).
- Free-period overrides also app-layer (`FREE_PERIOD_DISABLED_FEATURES`).
- RLS allows clinic members to write feature tables when role permits — **no** plan_entitlements check in policies.
- P1.7 probe (`PLAN-SEC-001`) confirmed live: starter doctor can INSERT `inventory_items` via PostgREST; real `createInventoryItemAction` denies with `featureDisabled`.

**Impact**

- Starter (or mis-set plan) client can INSERT into `crm_notifications`, `inventory_items`, `consent_forms`, etc. via PostgREST if RBAC helpers allow the role.
- UI/SA gates are not sufficient for “hard” entitlement claims at the DB boundary.

**Catching tests**

- `PLAN-INT-011` (COVERED / P3.5 — Pro SA `assertFeature` starter deny + pro allow), `PLAN-SEC-001` (COVERED — documents DB residual + SA deny).

**Resolution**

- **WAIVED for MVP 2026-07-28 (P1.11 Option B):** accepted app-only entitlements residual. Option A (`clinic_has_feature(key)` in RLS WITH CHECK for Pro+ tables) deferred — wider blast radius (many tables + free-period dual-path) vs D-02’s single cheap trigger. Revisit post-MVP if PostgREST abuse becomes a real threat; SEC probe stays green documenting the gap.

---

### D-04 — Custom JWT access-token hook optional (S1) — **ACCEPTED for MVP 2026-07-28** *(TEN-SEC-003 residual closed P6b.8)*

**Evidence**

- [`supabase/migrations/20260713000006_code_review_b5_jwt_custom_claims.sql`](../../supabase/migrations/20260713000006_code_review_b5_jwt_custom_claims.sql).
- [`docs/DB-OrdinacijaOS.md`](../DB-OrdinacijaOS.md) §2: “mora se ručno uključiti u dashboardu”.
- Helpers fall back to `profiles` when JWT claims missing.
- Local CI: [`supabase/config.toml`](../../supabase/config.toml) `[auth.hook.custom_access_token] enabled = true` since P0.2 — security suite always runs with hook on.
- `TEN-SEC-004` COVERED (P1.8) — hook-off fallback still resolves `current_clinic_id` from `profiles`.
- **P6b.8:** `TEN-SEC-003` closed — [`20260728040000_fix_stale_jwt_role_prefer_profiles.sql`](../../supabase/migrations/20260728040000_fix_stale_jwt_role_prefer_profiles.sql) makes `current_app_role` / `is_clinic_owner` **profiles-first** (demotion no longer trusts stale JWT `app_role`). `current_clinic_id()` stays JWT-first (D7).

**Impact**

- Misconfigured prod → extra DB reads; MFA/role claim freshness still depends on token refresh for `clinic_id` claim path; **role authorization no longer stale**.

**Catching tests**

- `TEN-SEC-004` COVERED; `TEN-SEC-003` COVERED (P6b.8); Production-Ops checklist item for hook enablement.

**Resolution**

- **ACCEPTED for MVP 2026-07-28 (P5 exit):** dual-path (JWT claims + profiles) remains intentional for hook on/off. Local/CI hook on. Prod Free-tier may leave hook off — fallback OK for UAT.
- **P6b.8 (2026-07-28):** stale-role demotion residual fixed at DB helpers (profiles-first for role). Not a JWT-hook model rewrite.

---

### D-05 — Pure unit tests not in CI (S1) — **RESOLVED 2026-07-23**

**Evidence**

- [`package.json`](../../package.json): `"test": "vitest run"`, `"test:security": "vitest run lib/security/..."`.
- [`.github/workflows/security.yml`](../../.github/workflows/security.yml) runs only `npm run test:security`.
- [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) runs Playwright only.
- 14 pure unit files under `lib/**/*.test.ts` never run on PR.

**Impact**

- Regressions in money/VAT, CSV, entitlements free-period, lead validation, etc. can merge unnoticed.

**Catching tests**

- CI job `npm test` with security tests either included (needs env) or split: `test:unit` without live Supabase.

**Resolution**

- P0.2 (done 2026-07-23): [`supabase/config.toml`](../../supabase/config.toml) committed so a local Supabase stack (Auth hooks/MFA/JWT expiry) is reproducible for `test:security` in CI — prerequisite for P0.6/P0.7.
- P0.4 (done 2026-07-23): [`package.json`](../../package.json) scripts split — `test:unit` = `vitest run --exclude "lib/security/**"` (14 files, verified green, zero Supabase env needed), `test:security` = the 2 existing security files (unchanged allowlist), `test` = `npm run test:unit && npm run test:security` composed so both run when local DB is up. Verified `test:unit` passes standalone with no `.env.local`/env vars present.
- P0.6 (done 2026-07-23): added [`.github/workflows/unit.yml`](../../.github/workflows/unit.yml) — runs `npm run test:unit` on every `pull_request` and on `push` to `main`, no secrets/`env:` block (confirmed the 14-file/59-test suite is fully DB-free). This closes the "14 pure unit files never run on PR" evidence above.
- P0.7 (done 2026-07-23): rewrote [`.github/workflows/security.yml`](../../.github/workflows/security.yml) to run `test:security` against a **local** Supabase CLI stack (`supabase start` + `db reset`, env vars sourced from `supabase status -o env`) instead of remote-project secrets. This is the "documented staging fallback" alternative resolved in favor of local, per the plan's stated preference. **Proven green 2026-07-23**: latest run on `main` (commit `37a4927`, run [`30048179856`](https://github.com/ZijadLejlic/ordinacijaOS/actions/runs/30048179856)) — `supabase start` → `supabase db reset` → `npm run test:security` (`SECURITY_TESTS_REQUIRED=1`) → `2 passed (2)` files / `21 passed (21)` tests, workflow conclusion `success`. Same push's `Unit tests` job: `15 passed (15)` files / `65 passed (65)` tests (also `success`), confirming `.github/workflows/unit.yml` runs on every push/PR with no secrets.
- P0.8 (done 2026-07-23): [`security.yml`](../../.github/workflows/security.yml) now sets `SECURITY_TESTS_REQUIRED: "1"` on the `test:security` step, and [`getSecurityTestEnv()`](../../lib/security/test-env.ts) throws (module-load time, so the file reports **failed**, not skipped) if that flag is set and any DB env var is still missing — closing the "still possible if `supabase start` were ever skipped/misconfigured" gap. Verified live both ways (flag+missing env → `2 failed`, real `exit 1`; no flag+missing env → clean `2 skipped`, `exit 0`) and unit-tested in [`test-env.test.ts`](../../lib/security/test-env.test.ts).
- **Closed 2026-07-23**: confirmed via `gh run list`/`gh run view --log` that P0.7's live `supabase start`/`db reset`/`test:security` run is green on the actual GitHub Actions runner (Docker available there) — see D-01 for the full log excerpt. No further action open for D-05.

---

### D-06 — D13 owner notification incomplete (S1) — **RESOLVED 2026-07-28 (product decision)**

**Evidence**

- PRD D13 previously: “5 failed logins → notifikacija owneru” / “email/in-app”.
- [`supabase/migrations/20260713000004_code_review_b2_login_lockout.sql`](../../supabase/migrations/20260713000004_code_review_b2_login_lockout.sql): `record_failed_login` sets lock + inserts `audit_events` `auth.login_lockout`.
- [`lib/auth/actions.ts`](../../lib/auth/actions.ts): calls RPCs; no Resend to owner.
- Audit UI is owner-only — notification is passive (must open audit), not push email/in-app bell.

**Impact**

- Owner may not learn of attacks in near-real-time without opening Audit.

**Catching tests**

- `AUTH-DB-001` COVERED (lock + audit insert).
- `AUTH-INT-002` COVERED — owner JWT can read `auth.login_lockout`; doctor cannot ([`lib/security/lockout-owner-notify.test.ts`](../../lib/security/lockout-owner-notify.test.ts)).

**Resolution**

- **RESOLVED 2026-07-28 (product decision):** MVP owner notification = `audit_events` `auth.login_lockout` in owner Audit UI. Push email / in-app bell deferred until §6.16 notification center. PRD D13 / §8.1 aligned. No Resend path invented for MVP.
---

### D-07 — D12 force logout is per-user (product decision) — **RESOLVED 2026-07-28 (docs)**

**Evidence**

- Product decision (P3.4 / D-07): force logout stays **per-user** (one `profileId`), not clinic-wide. No `forceLogoutAllClinicSessionsAction`.
- [`lib/invites/actions.ts`](../../lib/invites/actions.ts) `forceLogoutUserAction` + deactivate path call `public.revoke_user_sessions` for that user only (sibling sessions stay valid — `AUTH-INT-020`).

**Impact**

- None as product intent: owner revokes one staff member’s sessions at a time.

**Catching tests**

- `AUTH-INT-020` COVERED (per-user revoke + sibling OK + non-owner deny).

**Resolution**

- **RESOLVED 2026-07-28 (docs-only):** PRD D12 / §8.1 wording aligned to per-user; product behavior unchanged. Per-user revoke path fixed earlier via D-22 (`revoke_user_sessions`).

---

### D-08 — `updateInvoiceLegalSettingsAction` missing feature / write-block gates (S2) — **RESOLVED 2026-07-28**

**Evidence**

- [`lib/invoices/actions.ts`](../../lib/invoices/actions.ts) `updateInvoiceLegalSettingsAction`: uses `requireInvoiceWriter()` then **extra** `profile.role !== "owner"` check.
- Original inventory claimed missing `assertFeature(..., "invoices")` **and** `getClinicWriteBlock` (unlike `createInvoiceAction`).

**Impact**

- Minor: owner on readonly clinic might still patch `settings_json` legal fields if clinics UPDATE policy allows; feature flag inconsistent.

**Catching tests**

- `FIN-INT-015` (High): owner writable allow; readonly → `clinicReadonly`; accountant → `forbidden`.

**Resolution**

- **RESOLVED 2026-07-28 (P3.7):** Live probe proved write-block was **already** present — `requireInvoiceWriter()` calls `getClinicWriteBlock` (same path as every other invoice writer). Do **not** invent a second write-block call. Residual was `assertFeature(..., "invoices")` inconsistency vs `createInvoiceAction` — added for defense-in-depth / consistency. `invoices` is enabled on all plans (seed), so no starter `featureDisabled` path (unlike PLAN-INT-011 Pro-only keys). Suite: [`lib/security/invoice-legal-settings-sa.test.ts`](../../lib/security/invoice-legal-settings-sa.test.ts) (`3 passed`).

---

### D-09 — PRD §3.2 assistant/reception patient access vs code (S2)

**Evidence**

- PRD: assistant “Read/assist”, reception “Osnovno”.
- [`lib/patients/rbac.ts`](../../lib/patients/rbac.ts): `canWritePatients` true for owner, doctor, assistant, **and** reception (same as access).

**Impact**

- Reception can mutate full chart fields (allergies, docs, images) if UI exposes actions — stronger than “Osnovno” implies.

**Catching tests**

- RBAC tests assert **code** truth; product must clarify.

**Resolution**

- Update PRD to “write basic chart” **or** split `canWritePatients` / field-level rules.

---

### D-10 — PRD §12.1 acceptance checkboxes vs automated coverage (S2)

**Evidence**

- PRD §12.1 marks nearly all MVP acceptance items `[x]`.
- Traceability shows many `GAP`/`PARTIAL` (GDPR export API residual notes, branding, CRM send, peer amounts, aal2 RLS, etc.). Invite accept E2E (`AUTH-E2E-002`) COVERED as of P4.2.

**Impact**

- False confidence that “done” means “release-blocker tested”.

**Catching tests**

- This QA pack; treat Traceability Status as truth for automation.

**Resolution**

- Split PRD checkboxes into `implemented` vs `automated test green`.

---

### D-11 — Treatment plan item closure from visit still open (S2)

**Evidence**

- PRD §12.1 / §6.4 note: “zatvaranje stavke iz posjete još nije — follow-up”.
- Treatment plan actions exist on chart; no visit→item completion wiring asserted in Tech as done.

**Impact**

- Incomplete clinical loop vs PRD narrative.

**Catching tests**

- `PII-INT-011` extended when feature lands.

**Resolution**

- Track as known open product item; do not mark acceptance complete.

---

### D-12 — Session TTL 7 days not asserted in repo (S2) — **RESOLVED 2026-07-28 (P6b)**

**Evidence (original)**

- PRD D12 / Tech §5 claim TTL 7 days.
- No automated test or checked-in Auth config proving JWT/refresh expiry = 7d.
- Ops may set in Supabase dashboard only.

**Impact**

- Drift possible between environments.

**Catching tests**

- `AUTH-INT-021` / Production-Ops check.

**Resolution**

- **RESOLVED 2026-07-28 (P6b):** Local `supabase/config.toml` already pins `jwt_expiry = 604800` and `[auth.sessions] timebox = "168h"` (P0.2). Added [`lib/security/session-ttl-config.test.ts`](../../lib/security/session-ttl-config.test.ts) asserting those values. Documented hosted dashboard mirror in [`docs/Production-Ops.md`](../Production-Ops.md). No GoTrue API invented.

---

### D-13 — RLS spot-checks (confirm in P1; partially documented) (S1) — **RESOLVED 2026-07-28**

| Spot-check | Documented intent | Automated today |
|---|---|---|
| `leads` deny-all for anon/authenticated | DB doc §3.1 + migration `marketing_leads` | **COVERED** `MKT-SEC-001` (P1.5) |
| `clinic_subscriptions` no INSERT policy | DB doc §3.2 | **COVERED** under `PLAN-RLS-001` ID-drift cite (P1.5) |
| `audit_events` SELECT owner-only | migration `phase3c_audit_log_ui` | **COVERED** `RBAC-RLS-005` |
| Storage buckets non-public list | Tech §6 | **COVERED** `FILE-SEC-001` + `FILE-RLS-002` / `FILE-SEC-003` (P1.2) |
| Payments / invoice_lines append-only | Tech finance | **RESOLVED** — `FIN-RLS-001` COVERED (D-20) |
| `pin_hash` not selectable | DB doc D10 | Covered via `AUTH-SEC-002` + PIN RPC tests |

**Impact**

- Was: undetected policy regressions on marketing leads / finance append-only / branding storage.

**Resolution**

- **RESOLVED 2026-07-28 (P5 exit):** P1–P2 security suite closed every spot-check row above. No open S1 residual under this ID.

---

### D-14 — Allocate invoice number temporary service-role fallback (S2) — RESOLVED 2026-07-28

**Evidence**

- Tech changelog / invoices note: temporary service-role fallback for Postgres 42702 until fix migration `20260714040000_fix_allocate_invoice_number`.
- Fix migration exists in repo **but was incomplete**: `ON CONFLICT (clinic_id, series_year)` remained ambiguous under `RETURNS TABLE (series_year, …)` — same Postgres 42702.
- **P2.1 live probe (2026-07-28):** every same-clinic `allocate_invoice_number` RPC call hit `42702` / `column reference "series_year" is ambiguous`; cross-clinic still correctly raised `forbidden_clinic` (checks run before INSERT). App path in `lib/invoices/allocate-number.ts` therefore always fell through to the service-role optimistic upsert for successful allocates. Caller today passes `profile.clinic_id` only (`lib/invoices/actions.ts`), so AC4 was not currently exploitable via the SA — but the JWT clinic gate on the happy path was dead.

**Impact**

- Happy-path allocate bypassed the SECURITY DEFINER JWT/`current_clinic_id` checks and used service-role instead.
- Concurrent uniqueness depended on the app-level optimistic loop, not the DB row lock.

**Catching tests**

- `FIN-SEC-001`, `FIN-DB-001`, `FIN-INT-001` (`lib/security/allocate-invoice-number.test.ts`).

**Resolution**

- **Done (RPC, 2026-07-28, P2.1):** migration [`20260728010000_fix_allocate_invoice_number_on_conflict.sql`](../../supabase/migrations/20260728010000_fix_allocate_invoice_number_on_conflict.sql) — `ON CONFLICT ON CONSTRAINT invoice_number_counters_pkey`. Applied live via Supabase MCP; FIN-SEC/DB/INT-001 green against the RPC (no fallback).
- **Done (app, 2026-07-28, P2.9):** deleted `allocateInvoiceNumberFallback` / `createServiceClient` from `lib/invoices/allocate-number.ts`. Allocate is RPC-only; any RPC failure returns `{ error: "createFailed" }` (no service-role bypass). Confirmed FIN-SEC/DB/INT-001 still green after removal.

---

### D-20 — Payments / invoice_lines append-only broken by PERMISSIVE MFA FOR ALL (S1) — RESOLVED 2026-07-28

**Evidence**

- Phase2d migration comments claim `payments` / `invoice_lines` are “fully append-only: no UPDATE/DELETE policy at all” (only SELECT + INSERT named policies).
- Same migration also creates `payments_owner_mfa_aal2` / `invoice_lines_owner_mfa_aal2` as **PERMISSIVE `FOR ALL`** `using (owner_mfa_ok())` (explicit warning in SQL: “⚠️ PERMISSIVE, not RESTRICTIVE … finance group”).
- Postgres RLS: one matching PERMISSIVE policy is enough. For accountant (`owner_mfa_ok()` → true for non-owners), that FOR ALL policy alone grants DELETE and UPDATE.
- **P2.2 live probe (2026-07-28):** authenticated accountant DELETE/UPDATE on both `payments` and `invoice_lines` succeeded (rows removed / rewritten). Test: [`lib/security/payments-append-only-void.test.ts`](../../lib/security/payments-append-only-void.test.ts) (`FIN-RLS-001`).

**Related residual (same phase, lower blast):** `recompute_invoice_payment_status` on void invoices returns without raising — PostgREST can still INSERT a payment after void; SA `recordPaymentAction` correctly returns `invoiceVoid` (`FIN-INT-004` COVERED at INT; DB harden optional).

**Impact**

- BR-F03 / BR-F04 / Threat-Model `T-FIN-03` (tamper DELETE payment / rewrite line) not enforced at DB for any role that passes `owner_mfa_ok()`.
- Missing named DELETE policy is insufficient defense when a PERMISSIVE FOR ALL MFA policy exists.

**Catching tests**

- `FIN-RLS-001` (`lib/security/payments-append-only-void.test.ts`).

**Resolution**

- **Done (2026-07-28):** migration [`20260728020000_fix_finance_mfa_restrictive_append_only.sql`](../../supabase/migrations/20260728020000_fix_finance_mfa_restrictive_append_only.sql) — (1) flip all five finance `*_owner_mfa_aal2` policies to **RESTRICTIVE** (invoices, invoice_lines, payments, payment_plans, payment_plan_installments — match expenses/patients); (2) `REVOKE UPDATE, DELETE` on `payments` / `invoice_lines` from `anon`/`authenticated`. Applied live via Supabase MCP. FIN-RLS-001 flipped to expect deny; live `3 passed (3)`.

---

### D-21 — `FILE-INT-020` ID-drift + GDPR storage cleanup split (S2) — documented P2.5

**Evidence**

- Threat-Model `T-PII-02` and Business-Rules cite test id `FILE-INT-020`, but Test-Strategy.md §4 has **no** such catalog row (only `FILE-INT-001` / `FILE-INT-011`).
- `approve_gdpr_patient_erasure` hard-deletes the DB subtree only; Storage cleanup is in `approvePatientErasureAction` (`listPatientStoragePaths` → RPC → `deletePatientStorageObjects`), with a best-effort `catch` that can hide remove failures.
- P2.5 covers storage-empty under `PII-INT-001` (`lib/security/gdpr-erasure-subtree.test.ts`); live owner `storage.remove` works (assert via Storage **list**, not download).

**Impact**

- Docs cross-refs to `FILE-INT-020` are dangling; searchers may think storage erase is untested.
- Silent SA catch is observability-only while remove succeeds; if Storage RLS ever regresses, UI still shows success with orphaned blobs.

**Catching tests**

- `PII-INT-001` COVERED (includes storage path family that Threat-Model labeled `FILE-INT-020`).

**Resolution**

- Docs-consistency: either add a Test-Strategy `FILE-INT-020` row aliasing `PII-INT-001`, or retarget Threat-Model/Business-Rules to `PII-INT-001` only.
- Optional hardening: fail the SA (or audit) when `deletePatientStorageObjects` throws / remove returns empty; or use service-role client for post-approve storage delete only.

---

### D-15 — Security tests skip when env missing (S1) — **RESOLVED 2026-07-23**

**Evidence**

- `lib/security/test-env.ts` → `describe.skip` when keys absent.
- Local `npm test` can report green without running Critical RLS tests.
- **Bug found while implementing P0.4**: both [`lib/security/tenant-isolation.test.ts`](../../lib/security/tenant-isolation.test.ts) and [`lib/security/rbac-and-lifecycle.test.ts`](../../lib/security/rbac-and-lifecycle.test.ts) destructured `const { url, anonKey, serviceKey } = env!;` directly in the `describe(...)` callback body. Vitest/Jest always execute the `describe` callback to discover the suite tree — even under `describe.skip` — so with no Supabase env configured this threw `TypeError: Cannot destructure property 'url' of 'env' as it is null` and the suite reported as a **failed file**, not a skip. Confirmed pre-existing via `git stash` + `npx tsc`/`vitest run` before this session's edits.

**Impact**

- Contradicted the intended graceful "skip locally, fail closed in CI" design: without `SECURITY_TESTS_REQUIRED` even set, running with no DB configured crashed instead of skipping — the opposite failure mode from the one D-15 originally described (crash, not silent green), but still not the documented behavior.

**Catching tests**

- CI must fail closed; local optional skip OK with loud log.

**Resolution**

- **Done (2026-07-23, as part of P0.4):** moved the `env!` destructure out of the `describe` body into `beforeAll` (`let url/anonKey/serviceKey` declared in the closure, assigned via `({ url, anonKey, serviceKey } = env!)` inside `beforeAll`, which — unlike the `describe` callback — is genuinely skipped by `describe.skip`). Verified: with `.env.local` temporarily moved aside and no Supabase env vars set, `npm run test:security` now reports `2 skipped (2)` / exit 0 instead of throwing.
- **Done (2026-07-23, P0.8)**: [`getSecurityTestEnv()`](../../lib/security/test-env.ts) now throws (naming the missing var(s)) instead of returning `null` when `SECURITY_TESTS_REQUIRED=1` — this call still happens at `describe`-body top level (both test files), so vitest treats it as a **failed** file, not a skip, and the process exits non-zero. [`security.yml`](../../.github/workflows/security.yml) sets that flag on its `test:security` step, so this is enforced in CI, not just available. Verified live: no flag → `2 skipped`/`exit 0`; flag set + env missing → `2 failed`/`exit 1`. Unit-tested in [`lib/security/test-env.test.ts`](../../lib/security/test-env.test.ts) (6 cases: missing×flag-off → null, missing×flag-on → throws naming the var, present×either → returns env, regardless of flag).

---

### D-16 — Demo clinic lifecycle exemptions (S3 / intentional) — **TESTED 2026-07-28**

**Evidence**

- `clinics.is_demo`; migrations `marketing_demo_clinic`; seed script sets `status: readonly`.
- Lifecycle RPCs skip demo.

**Impact**

- Correct product behavior; must be tested so real clinics are not skipped by buggy `is_demo` flag.

**Catching tests**

- `LIFE-SEC-002` COVERED (`lifecycle-transitions.test.ts`): transitions skip `is_demo` past-grace; `hard_delete_clinic` raises `demo_clinic`.

---

### D-17 — Peer amounts default not in PRD (S2) — **PINNED for tests 2026-07-28**

**Evidence**

- DB doc lists `doctors_see_peer_amounts` (D17); default not in Decision Log.
- Behavior in `dashboard_payment_stats` RPC.
- **Pinned (P2.3):** `clinics.settings_json` column default in `20260712900001_phase1_foundation.sql` is `doctors_see_peer_amounts: false`; RPC `coalesce(..., false)` matches. `FIN-INT-020` asserts this on a fresh clinic insert. Demo seed (`scripts/seed-demo-clinic.ts`) sets `true` for UX demo only — not the product default.

**Impact**

- Ambiguous expected default for tests — **resolved for catalog** (false). PRD Decision Log still silent.

**Catching tests**

- `FIN-INT-020` COVERED — pins DB default false + setting-off leak probe.

**Resolution**

- Tests use DB default **false**. Optional: add the same default to PRD Decision Log D17 for product clarity (docs-only; not blocking).

---

### D-18 — Faza 4 / out-of-scope items marked N/A (S3)

Stripe, AI, SMS/WhatsApp, portal, online booking, mini-site, lab — correctly out of MVP. No discrepancy unless code ships them early (negative `PLAN-INT-010`).

---

### D-19 — Implementation-Plan P0.5 "≥40% statements" baseline did not match measured coverage (S2) — **RESOLVED 2026-07-23**

**Evidence**

- [`Implementation-Plan.md`](./Implementation-Plan.md) P0.5 assumed a starting threshold of "statements ≥40%" before any measurement was taken.
- Wired real `@vitest/coverage-v8` into [`vitest.config.ts`](../../vitest.config.ts) scoped to `lib/**/*.ts` (excl. `*.test.ts` and `lib/security/test-env.ts`) and ran `npm run test:coverage` (= `npm run test:unit` + `--coverage`, no live Supabase required): **Statements 10.34% (401/3875), Branches 7.35%, Functions 14.14%, Lines 10.52%** — measured 2026-07-23.
- Root cause of the gap vs the plan's assumption: `lib/**` includes many `actions.ts` / `rbac.ts` / `gate.ts` files that are Server Actions or RLS-dependent gates with **0% coverage today** because they can only be meaningfully tested via INT/security suites (P1–P4), not pure unit tests. The 14 existing pure-unit `*.test.ts` files cover parsers/validators/money-math well, but that's a small slice of `lib/`.

**Impact**

- Locking the threshold at the plan's assumed 40% would make `npm run test:coverage` fail immediately and permanently until P1–P4 land real INT coverage — contradicting Principle 1 ("no silent skips", implicitly also "no immediately-red gates that teach people to ignore CI").

**Resolution**

- Set `coverage.thresholds.statements = 10` in `vitest.config.ts` (just under the measured 10.34%, so the gate catches **regressions** going forward, not the pre-existing gap) and added `"test:coverage"` npm script (mirrors `test:unit`'s DB-free scope).
- Raising this threshold is still tracked as **P5.2** ("≥60% statements on `lib/`"), which will only be realistic once P1–P4 add INT-level tests for the currently-0%-covered `actions.ts`/`rbac.ts` files. Intermediate re-measurements should happen at the end of each phase (P1–P4), not just at P5.

**P5.2 follow-up (2026-07-28)**

- Unit-reachable surface (excl. `lib/**/actions.ts`, `lib/supabase/**`, factories, legal/seo/observability): **Statements 30.72%**. Threshold raised **10 → 30**; `test:coverage` wired into `.github/workflows/unit.yml`.
- Aspirational **60% on all of `lib/`** still deferred (SA/INT files stay out of the unit-coverage denominator). Owner list: include security suite in a coverage job, or expand pure units on validations/rbac helpers.
- Implementation-Plan.md table row text left as originally written (per existing convention); actual numbers and rationale tracked here + in the Progress log.

---

### D-22 — `forceLogoutUserAction` / deactivate pass profile UUID to `auth.admin.signOut(jwt)` (S1) — **RESOLVED 2026-07-28**

**Evidence (P3.4 live probe)**

- GoTrue Admin API: `signOut(jwt: string, scope?)` — first arg is a **logged-in JWT**, not a user id ([docs](https://supabase.com/docs/reference/javascript/auth-admin-signout); `GoTrueAdminApi.d.ts`).
- [`lib/invites/actions.ts`](../../lib/invites/actions.ts) previously called `service.auth.admin.signOut(profileId, "global")`.
- Live: force logout returned `invalid JWT: … malformed`; target `refreshSession()` still succeeded; no `user.force_logout` audit.

**Impact**

- Owner “force logout” and post-deactivate session revoke were **non-functional**.

**Catching tests**

- `AUTH-INT-020` in [`lib/security/invite-force-logout-deactivate.test.ts`](../../lib/security/invite-force-logout-deactivate.test.ts).

**Resolution**

- **Done (2026-07-28):** migration [`20260728030000_revoke_user_sessions.sql`](../../supabase/migrations/20260728030000_revoke_user_sessions.sql) — `public.revoke_user_sessions(p_user_id uuid)` SECURITY DEFINER deletes `auth.sessions` for one user (`refresh_tokens` CASCADE); `REVOKE` from `public`/`anon`/`authenticated`, `GRANT EXECUTE` to `service_role` only. SAs call `service.rpc("revoke_user_sessions", { p_user_id })` after owner gate. Live `AUTH-INT-020` happy path: target refresh fails, sibling session OK (D-07 per-user), audit written. Catalog COVERED.

---

### D-23 — `deactivateUserAction` UPDATE includes `updated_at` without column GRANT (S1) — **RESOLVED 2026-07-28**

**Evidence (P3.4 live probe)**

- A1 migration [`20260713000001_code_review_a1_profiles_self_update_lock.sql`](../../supabase/migrations/20260713000001_code_review_a1_profiles_self_update_lock.sql): column GRANT `(full_name, role, is_active)` only — **no** `updated_at`.
- `deactivateUserAction` previously did `.update({ is_active: false, updated_at: … })` → `permission denied for table profiles`.

**Impact**

- Owner soft-deactivate was broken end-to-end.

**Catching tests**

- Same `AUTH-INT-020` deactivate case in `invite-force-logout-deactivate.test.ts`.

**Resolution**

- **Done (2026-07-28):** SA updates `{ is_active: false }` only; `profiles_set_updated_at` trigger fills `updated_at`. Then `revoke_user_sessions` (D-22). Live: `is_active=false`, refresh fails, non-owner deny, audit `user.deactivated`.

---

## 3. Summary table

| ID | Sev | Topic | Test IDs |
|---|---|---|---|
| D-01 | S0 | Migrations stubs / non-reproducible DB | P0 harness — **RESOLVED** (2026-07-23), `supabase start`/`db reset` proven green in CI run `30048179856` |
| D-02 | S0 | Image limit app-only | `FILE-DB-001` — **RESOLVED** (2026-07-28), DB trigger `plan_limit_images` |
| D-03 | S0 | Feature entitlements app-only | `PLAN-SEC-001` — **WAIVED MVP** (2026-07-28), Option B accepted residual |
| D-04 | S1 | JWT hook manual | `TEN-SEC-004` ACCEPTED MVP dual-path; `TEN-SEC-003` **COVERED** (2026-07-28 P6b.8 profiles-first role helpers) |
| D-05 | S1 | Unit tests not in CI | P0 CI — **RESOLVED** (2026-07-23): unit.yml + security.yml (local Supabase) + fail-closed gate all green in CI run `30048179856` |
| D-06 | S1 | Lockout owner notify | `AUTH-INT-002` — **RESOLVED** (2026-07-28): MVP = audit event; email/bell deferred §6.16 |
| D-07 | S2 | Force logout scope | `AUTH-INT-020` — **RESOLVED** (2026-07-28 docs): per-user product decision; PRD aligned |
| D-08 | S2 | Invoice legal settings gates | `FIN-INT-015` — **RESOLVED** (2026-07-28): write-block via `requireInvoiceWriter`; `assertFeature("invoices")` added |
| D-09 | S2 | Patient RBAC wording | RBAC suite |
| D-10 | S2 | Acceptance checkbox optimism | Traceability |
| D-11 | S2 | Visit closes plan item | `PII-INT-011` |
| D-12 | S2 | Session TTL unasserted | `AUTH-INT-021` — **RESOLVED** (2026-07-28): config.toml + Production-Ops + unit assert |
| D-13 | S1 | RLS spot-check gaps | **RESOLVED** (2026-07-28): `MKT-SEC-001`, storage FILE-SEC/RLS, `FIN-RLS-001`, audit, PIN — all COVERED |
| D-14 | S2 | Invoice allocate fallback | `FIN-SEC-001` — **RESOLVED** (2026-07-28): RPC P2.1 + app fallback removed P2.9 |
| D-15 | S1 | Security suite skip-open | P0 — **RESOLVED** (P0.4 skip-crash fix + P0.8 `SECURITY_TESTS_REQUIRED` fail-closed gate, both live in CI) |
| D-16 | S3 | Demo exemption (tested) | `LIFE-SEC-002` COVERED |
| D-17 | S2 (pinned) | Peer amounts default | `FIN-INT-020` — **PINNED false** (P2.3; PRD Decision Log optional) |
| D-18 | S3 | Faza 4 N/A | `PLAN-INT-010` |
| D-19 | S2 | Coverage threshold baseline | P0.5 — **RESOLVED** |
| D-20 | S1 | Payments/lines append-only broken (PERMISSIVE MFA FOR ALL) | `FIN-RLS-001` — **RESOLVED** (2026-07-28): RESTRICTIVE MFA + REVOKE UPDATE/DELETE |
| D-21 | S2 | `FILE-INT-020` ID-drift; GDPR storage is SA not RPC | `PII-INT-001` — documented P2.5 |
| D-22 | S1 | `admin.signOut(profileId)` wrong API (needs JWT) | `AUTH-INT-020` — **RESOLVED** (2026-07-28): `revoke_user_sessions` RPC |
| D-23 | S1 | deactivate UPDATE `updated_at` without column GRANT | `AUTH-INT-020` — **RESOLVED** (2026-07-28): update `is_active` only |

---

## 4. Verification method used

1. Read PRD Decision Log + §3–§12, Tech, DB docs.
2. Enumerated `supabase/migrations/*` (stubs vs full SQL).
3. Mapped `lib/*/rbac.ts`, entitlements, server actions, API routes, middleware (prior exploration).
4. Inventoried `lib/**/*.test.ts`, `e2e/**/*.spec.ts`, `.github/workflows/*`.
5. Spot-read lockout SQL, force logout, invoice legal settings, patients RBAC, image assert call sites.

No application code was changed for this report.

---

*Discrepancies — DentOrd QA — updated 2026-07-28 (P5 exit: all S0/S1 fixed, waived, or accepted).*
