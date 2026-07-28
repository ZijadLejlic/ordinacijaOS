# DentOrd QA & Security — Index

> Analysis-only deliverables. No application or test code is introduced by these documents.
> Product source of truth: [`docs/PRD-OrdinacijaOS.md`](../PRD-OrdinacijaOS.md).  
> Architecture: [`docs/Tech-OrdinacijaOS.md`](../Tech-OrdinacijaOS.md).  
> Schema / RLS: [`docs/DB-OrdinacijaOS.md`](../DB-OrdinacijaOS.md).

| Field | Value |
|---|---|
| Status | Analysis + P0–P5 implementation (Traceability COVERED sweep + UAT cross-link 2026-07-28) |
| Scope | Professional MVP (Faze 1–3); Faza 4 noted only as residual risk |
| Emphasis | Security → multi-tenant isolation → RLS → financial/PII → functional |
| Target test runtime | Hermetic local Supabase (CLI) — see [Implementation-Plan.md](./Implementation-Plan.md) P0 |

---

## 1. Document map

| Document | Purpose |
|---|---|
| [Traceability-Matrix.md](./Traceability-Matrix.md) | Every PRD requirement / Decision Log item / §12 acceptance criterion → existing or proposed tests; requirement quality findings |
| [Business-Rules-and-RBAC.md](./Business-Rules-and-RBAC.md) | Extracted business rules + enforcement points; reconciled permission matrix; critical user journeys |
| [Threat-Model.md](./Threat-Model.md) | STRIDE-style threats for auth, authz, tenancy, finance, PII, uploads, impersonation, cron/service-role |
| [Test-Strategy.md](./Test-Strategy.md) | Risk-based catalog across all test levels; fixtures; tooling recommendations |
| [Discrepancies.md](./Discrepancies.md) | PRD/Tech/DB vs actual code — verified findings with evidence |
| [Implementation-Plan.md](./Implementation-Plan.md) | Phased P0–P5 roadmap to build tests + hermetic DB, with exit criteria |

---

## 2. Methodology

1. **Do not assume PRD == code.** Every claim is checked against migrations, server actions, RLS helpers, middleware, and existing tests. Gaps go into [Discrepancies.md](./Discrepancies.md).
2. **Risk-first.** Critical = release blocker (tenant leak, auth bypass, money tampering, PII erasure failure, RLS bypass). Functional polish is Medium/Low until Critical/High are green.
3. **Defense in depth.** Prefer asserting the same rule at the layer that owns it (DB/RLS for tenancy and hard limits; server actions for RBAC + entitlements; E2E for journeys) and add a thin negative test one layer up to catch bypasses.
4. **Hermetic where possible.** Future DB/RLS/integration suites target local Supabase (`supabase db reset`). Playwright may still hit staging for full-stack smoke.
5. **Keep the existing stack.** Vitest + Playwright + Supabase clients already configured — extend, do not replace (see Test-Strategy § tooling).

---

## 3. Test ID scheme

Format: `AREA-LEVEL-###`

### AREA

| Code | Domain |
|---|---|
| `AUTH` | Signup, login, MFA, lockout, session, invites, PIN operators |
| `TEN` | Multi-tenant isolation (clinic A vs B) |
| `RBAC` | Role permission matrix |
| `FIN` | Invoices, payments, payment plans, expenses, Excel, peer amounts |
| `PII` | Patients, GDPR export/erasure, analytics without names |
| `FILE` | Storage buckets, signed URLs, image/document limits |
| `CAL` | Appointments, overlap, waitlist, calendar views |
| `PLAN` | Plans, entitlements, D8 hard limits, free-2026 overrides |
| `LIFE` | Clinic lifecycle (trial → readonly → pending_delete → hard delete) |
| `CRM` | Email templates, outbound messages, CRM notifications |
| `IMP` | CSV import (patients/services) |
| `PLAT` | Platform admin, impersonation, plan/status flags |
| `MKT` | Marketing site, leads, cookie consent, SEO |

### LEVEL

| Code | Meaning |
|---|---|
| `UNIT` | Pure function / Zod / parser (no DB) |
| `DB` | Constraints, triggers, RPCs, migrations |
| `RLS` | Row Level Security policies under authenticated JWT |
| `INT` | Server action + DB (local Supabase) |
| `API` | Route Handlers (`app/api/*`) |
| `E2E` | Playwright browser journeys |
| `SEC` | Explicit security abuse cases (often overlaps RLS/INT) |

Example: `TEN-RLS-001`, `FIN-INT-014`, `AUTH-E2E-003`.

### Coverage status

| Status | Meaning |
|---|---|
| `COVERED` | Automated test exists today (cite file) |
| `PARTIAL` | Some scenarios covered; gaps remain |
| `GAP` | Proposed; not yet implemented |
| `N/A` | Out of MVP / untestable as written / deferred Faza 4 |

---

## 4. Priority definitions

| Priority | Definition | Release impact |
|---|---|---|
| **Critical** | Tenant isolation failure, auth/MFA bypass, financial integrity, GDPR hard-delete correctness, service-role exposure, RLS bypass | **Release blocker** |
| **High** | Core user journeys (signup→onboarding, appointment, invoice+PDF), plan hard limits, owner-only surfaces | Must be green before partner UAT of that module |
| **Medium** | Secondary modules (CRM, inventory, branding, import edge cases), RBAC negative paths for non-core roles | Fix in same sprint as feature |
| **Low** | Marketing copy, cosmetic responsive, SEO, non-security analytics | Batch / backlog |

---

## 5. Per-test field template

Every proposed test in [Test-Strategy.md](./Test-Strategy.md) includes:

| Field | Description |
|---|---|
| **ID** | `AREA-LEVEL-###` |
| **Requirement** | PRD § / Decision `D#` / acceptance §12 item |
| **Risk prevented** | What fails in production if this test is missing |
| **Level** | UNIT / DB / RLS / INT / API / E2E / SEC |
| **Preconditions** | Users, clinics, plan, fixtures, env |
| **Expected result** | Observable outcome (status, row absence, error code, audit event) |
| **Priority** | Critical / High / Medium / Low |
| **Status** | COVERED / PARTIAL / GAP |

---

## 6. How to run existing suites (today)

```bash
# Pure unit + security integration (skips security if env missing)
npm test

# Security only (requires Supabase env — currently remote)
npm run test:security

# Playwright E2E (build + Chromium; requires Supabase env)
npm run test:e2e

# Dev-server E2E (reuse local next)
npm run test:e2e:dev
```

**Required env (security + E2E):**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Loaded from `.env.local` / `.env` via `lib/security/test-env.ts` and `e2e/helpers/env.ts`.

### Flaky quarantine

See root [`README.md`](../../README.md) (P5.6) and [Test-Strategy.md](./Test-Strategy.md) § Regression: issue link → `fix`/`@flaky` → un-quarantine in fix PR; max 1 CI retry; do not delete coverage.

**CI today (P5 release gate):**

| Workflow | Role | Trigger |
|---|---|---|
| `.github/workflows/release-gate.yml` | Calls lint + unit + security + e2e; aggregator fails unless all green | push `main`, PRs |
| `.github/workflows/lint-typecheck.yml` | ESLint + `tsc --noEmit` | `workflow_call` only |
| `.github/workflows/unit.yml` | `npm run test:coverage` | `workflow_call` only |
| `.github/workflows/security.yml` | Local Supabase + `test:security` (fail-closed) | `workflow_call` only |
| `.github/workflows/e2e.yml` | Playwright blockers + service-role bundle check | `workflow_call` only |

---

## 7. Existing automated coverage (snapshot)

| Layer | Files | Supabase | CI |
|---|---|---|---|
| Pure unit (Vitest) | `lib/**/*.test.ts` (excl. security INT) | No | release gate → `unit.yml` |
| Security integration (Vitest) | `lib/security/*.test.ts` | Local in CI | release gate → `security.yml` |
| E2E (Playwright) | 7 specs under `e2e/` (incl. marketing + invite) | Yes + running app | release gate → `e2e.yml` |
| Demo seed | `scripts/seed-demo-clinic.ts` | Yes | Manual |

---

## 8. Related product docs

- Partner UAT checklist (Auto vs Ručno): [`docs/UAT-Partner.md`](../UAT-Partner.md)
- Production ops: [`docs/Production-Ops.md`](../Production-Ops.md)
- Prior code review: [`docs/CODE-REVIEW-2026-07.md`](../CODE-REVIEW-2026-07.md)

---

*DentOrd QA index — updated 2026-07-28.*
