# DentOrd — QA Implementation Plan (P0–P5)

> Phased roadmap to **build** the tests and hermetic harness described in this QA pack.
> This document is the plan only — analysis docs are already authored under `docs/QA/`.
> Each phase is independently verifiable with explicit exit criteria.
> Emphasis: security → multi-tenant → RLS → finance/PII → functional (per stakeholder choice).
> Target runtime: **local Supabase CLI** for DB/RLS/INT; Playwright may use local or staging.

Related: [Test-Strategy.md](./Test-Strategy.md), [Discrepancies.md](./Discrepancies.md), [Threat-Model.md](./Threat-Model.md).

---

## Principles

1. **No silent skips in CI** — Critical security suites fail closed if env/DB missing.
2. **Keep tooling** — Vitest, Playwright, `@supabase/*`; add Supabase CLI + optional pgTAP later.
3. **One phase = one PR series** — merge when exit criteria green; do not block on later phases.
4. **Fix product gaps only when a test proves them** — except P0 schema dump (unblocks everything).
5. **Factories first** — shared seed helpers before exploding test count.

---

## P0 — Reproducible DB + test harness

**Goal:** Any developer/CI can `supabase db reset` and run unit + security tests without the remote project.

### Work items

| # | Task | Notes |
|---|---|---|
| P0.1 | Dump remote schema into real SQL migrations | Replace phase 2 stubs with executable SQL; ensure phase 1 foundation exists in repo |
| P0.2 | Commit `supabase/config.toml` Auth settings | Enable custom access token hook; MFA; JWT expiry aligned to D12 |
| P0.3 | Seed script for plans / entitlements / limits | Idempotent seed used by `db reset` |
| P0.4 | Split npm scripts | `test:unit` (no live DB), `test:security` (requires local/remote), `test` = unit+security when DB up |
| P0.5 | Vitest coverage config | Thresholds baseline (start low: statements ≥40%, raise in P5) |
| P0.6 | CI: run `test:unit` on every PR | New or extend workflow — **no secrets required** |
| P0.7 | CI: `supabase start` + `db reset` + `test:security` | Prefer local over remote staging |
| P0.8 | Fail closed | `SECURITY_TESTS_REQUIRED=1` → error if suite would skip |
| P0.9 | Shared factory module | Extract `createClinicWithRoles()` from e2e + security tests into `lib/security/factories.ts` (or `tests/factories`) |

### Exit criteria

- [x] Fresh clone: `supabase start && supabase db reset` succeeds with zero stub-only migrations blocking schema. *(Proven on GitHub Actions run [`30048179856`](https://github.com/ZijadLejlic/ordinacijaOS/actions/runs/30048179856), commit `37a4927` — Docker unavailable in the local dev sandbox, so this cannot be reproduced from that sandbox, only from a Docker-enabled runner.)*
- [x] `npm run test:unit` green in CI without Supabase secrets. *(Same run: `unit.yml` job "Unit tests" — 15 files / 65 tests passed, no `env:`/secrets.)*
- [x] `npm run test:security` green against **local** Supabase in CI (or documented staging fallback with secrets). *(Same run: `security.yml` job "Tenant isolation & RBAC (local Supabase)" — `supabase start` → `supabase db reset` → `test:security` — 2 files / 21 tests passed.)*
- [x] Skipping security tests in CI is impossible when `SECURITY_TESTS_REQUIRED=1`. *(`security.yml` sets `SECURITY_TESTS_REQUIRED: "1"` on the `test:security` step; `getSecurityTestEnv()` throws instead of skipping when env is missing and the flag is set — unit-tested in `lib/security/test-env.test.ts`.)*
- [x] Discrepancy **D-01** and **D-05** marked resolved in Discrepancies.md changelog note. *(Both flipped from partial/pending to **RESOLVED 2026-07-23** with the CI run evidence above.)*

### Verification command

```bash
supabase start
supabase db reset
npm run test:unit
SECURITY_TESTS_REQUIRED=1 npm run test:security
```

---

## P1 — Critical security (release blockers)

**Goal:** All Critical TEN/AUTH/FILE/PLAN-SEC rows from Test-Strategy §4.1 green (or explicitly waived with product sign-off).

### Work items

| # | Task | Test IDs |
|---|---|---|
| P1.1 | Expand tenant isolation to all clinic-scoped tables | `TEN-RLS-010..015`, `TEN-SEC-002` |
| P1.2 | Storage: branding + consent + invoice PDF paths | `FILE-RLS-002`, `FILE-SEC-001/003` |
| P1.3 | Owner MFA aal2 write denial under RLS | `AUTH-RLS-001` |
| P1.4 | Invite token reuse / expiry | `AUTH-SEC-001` |
| P1.5 | Leads deny-all; subscriptions no INSERT | `MKT-SEC-001`, `PLAN-RLS-001` |
| P1.6 | Image limit direct INSERT (expect fail or file residual) | `FILE-DB-001` |
| P1.7 | Feature entitlement PostgREST bypass probe | `PLAN-SEC-001` |
| P1.8 | JWT hook on vs off | `TEN-SEC-003`, `TEN-SEC-004` |
| P1.9 | Bundle/import guard: no service role in client | `PLAT-SEC-003` |
| P1.10 | Cron route rejects missing secret | `LIFE-API-001` |
| P1.11 | Optional product fixes | Triggers for D-02/D-03 if probes fail and product wants hard DB gates |

### Exit criteria

- [ ] `npm run test:security` covers every Critical TEN/AUTH/FILE row marked GAP → COVERED (or waived in Discrepancies with owner approval).
- [ ] Threats AC1–AC3, AC6 from Threat-Model have automated tests.
- [ ] PR checklist: “tenant isolation suite green” remains release blocker.

### Verification

```bash
SECURITY_TESTS_REQUIRED=1 npm run test:security
# plus any new LIFE-API / PLAT-SEC unit/INT files
```

---

## P2 — Financial & PII integrity

**Goal:** Money path and GDPR/lifecycle cannot silently corrupt or leak.

### Work items

| # | Task | Test IDs |
|---|---|---|
| P2.1 | `allocate_invoice_number` same-clinic + MFA + concurrency | `FIN-SEC-001`, `FIN-DB-001`, `FIN-INT-001` |
| P2.2 | Payments / lines append-only; void path | `FIN-RLS-001`, `FIN-INT-003/004` |
| P2.3 | Peer amounts setting | `FIN-INT-020` |
| P2.4 | PDF / Excel API RBAC | `FIN-API-001`, `FIN-API-002` |
| P2.5 | GDPR erase full subtree + storage | `PII-INT-001`, `FILE-INT-020` |
| P2.6 | Patient JSON + clinic ZIP API | `PII-API-001`, `PII-API-002` |
| P2.7 | Lifecycle transitions + demo skip | `LIFE-INT-002`, `LIFE-SEC-002` |
| P2.8 | Impersonation audit | `PLAT-INT-001` |
| P2.9 | Remove dead allocate service-role fallback if present | Discrepancy D-14 |

### Exit criteria

- [ ] All Critical FIN/PII/LIFE rows COVERED.
- [ ] Abuse cases AC4, AC5, AC7 automated.
- [ ] Manual spot-check: erase patient with files → storage empty.

### Verification

```bash
npm run test:security
npm run test:unit
# new INT files under lib/invoices, lib/privacy, lib/clinic
```

---

## P3 — Server actions, API & full RBAC matrix

**Goal:** Every role × sensitive action has positive and negative coverage at INT/API level.

### Work items

| # | Task | Test IDs |
|---|---|---|
| P3.1 | Parameterized RBAC matrix runner | `RBAC-INT-001..030` driven by Business-Rules §3 |
| P3.2 | Doctor calendar scope | `CAL-INT-004` |
| P3.3 | All 8 API routes auth matrix | health, cron, PDF, excel, privacy×2, og, sentry-test |
| P3.4 | Invite / force logout / deactivate | `AUTH-INT-010`, `AUTH-INT-020` |
| P3.5 | Feature assert on each Pro SA | `PLAN-INT-011` |
| P3.6 | Readonly clinic write block across modules | extend `LIFE-RLS-001` |
| P3.7 | Fix D-08 legal settings gates if tests fail | `FIN-INT-015` |

### Exit criteria

- [ ] For each role in §3.2, at least one allow + one deny INT assertion per major module.
- [ ] API routes: unauthenticated and wrong-role cases green.
- [ ] No Server Action Critical path without RBAC test reference in Traceability.

### Verification

```bash
npm run test:unit && SECURITY_TESTS_REQUIRED=1 npm run test:security
# RBAC INT suite timing budget < 5 min on CI
```

---

## P4 — Functional integration + E2E journeys

**Goal:** Critical user journeys J1–J7 automated beyond today’s 5 Playwright specs.

### Work items

| # | Task | Test IDs |
|---|---|---|
| P4.1 | Onboarding steps 2–3 E2E | extend `AUTH-E2E-001` |
| P4.2 | Staff invite accept E2E | `AUTH-E2E-002` |
| P4.3 | Waitlist on cancel INT/E2E | `CAL-INT-003` |
| P4.4 | Invoice void + partial payment E2E or INT | `FIN-INT-003/004` |
| P4.5 | Patient chart / odontogram / treatment plan INT | `PII-INT-010..012` |
| P4.6 | CRM send + email reminder INT | `CRM-INT-001/002` |
| P4.7 | CSV import dry-run+commit INT | `IMP-INT-001` |
| P4.8 | Inventory + branding smoke INT | `PLAN-INT-021/022` |
| P4.9 | Keep Playwright `workers: 1` until parallel-safe seeds | — |

### Exit criteria

- [ ] Journeys J1–J4, J5, J7 have automated coverage (E2E and/or INT).
- [ ] Existing e2e.yml still green; new specs tagged `@blocker` where required.
- [ ] High-priority Traceability gaps for §12.1 reduced to Medium/Low only.

### Verification

```bash
npm run build && npm run test:e2e
```

---

## P5 — Regression hardening & Medium/Low

**Goal:** Full release gate; flaky policy; marketing abuse; raise coverage.

### Work items

| # | Task | Test IDs |
|---|---|---|
| P5.1 | Wire lint + `tsc --noEmit` in CI | — |
| P5.2 | Coverage thresholds raise (e.g. ≥60% statements on `lib/`) | — |
| P5.3 | Lead rate limit + honeypot INT | `MKT-INT-001`, `MKT-SEC-002` |
| P5.4 | Marketing smoke E2E (pricing CTA, cookie, locales) | `MKT-E2E-001/002/004` |
| P5.5 | Optional pgTAP for RLS policy names | — |
| P5.6 | Flaky quarantine process documented in README | — |
| P5.7 | Lockout owner notification product decision + test | `AUTH-INT-002` |
| P5.8 | Update Traceability statuses COVERED across pack | — |
| P5.9 | UAT-Partner.md cross-link to automated vs manual | — |

### Exit criteria

- [ ] Single “release gate” workflow: unit + security (local) + e2e blockers + lint/typecheck.
- [ ] Medium catalog ≥70% COVERED or explicitly deferred with owner list.
- [ ] Discrepancies S0/S1 either fixed or formally accepted in PRD/Tech.

### Verification

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
SECURITY_TESTS_REQUIRED=1 npm run test:security
npm run test:e2e
```

---

## Suggested PR slicing (per phase)

```text
P0a  migrations dump + config.toml
P0b  npm scripts + CI unit
P0c  CI local supabase security
P1a  TEN table matrix expansion
P1b  MFA aal2 + storage + leads
P1c  plan/feature bypass probes (+ optional triggers)
P2a  finance allocate/append-only/API
P2b  GDPR/lifecycle/impersonation
P3a  RBAC matrix runner
P3b  API auth matrix
P4a  E2E invite + onboarding depth
P4b  clinical/CRM/import INT
P5   hardening + marketing
```

Each PR should update Traceability Status column for IDs it covers.

---

## Dependencies & risks

| Risk | Mitigation |
|---|---|
| Schema dump huge / noisy | Prefer declarative dump of `public` + `storage` policies only; exclude auth internals where CLI manages them |
| Local Auth MFA differs from prod | Document otpauth flow; seed enrolled factors via Admin API |
| CI time | Security suite budget 10 min; E2E budget 15 min; parallelize only after seed isolation |
| Product undecided on D-02/D-03 | Ship probes first; triggers as follow-up PR with product OK |
| Resend in CI | Mock; never send real email in automated tests |

---

## Out of scope (this roadmap)

- Implementing Faza 4 (Stripe, AI, SMS, portal).
- External pen-test engagement (track in PRD open items).
- Replacing Vitest/Playwright.
- Rewriting application features except fixes proven by P1–P3 failures and approved by product.

---

## Progress log

| Date | Phase | Note |
|---|---|---|
| 2026-07-23 | Analysis | QA docs authored; implementation not started |
| 2026-07-23 | P0.1 | **Done.** Real SQL for `20260712900001_phase1_foundation.sql` (new) + full rewrite of 5 phase2 stub migrations (clinical core, treatment plans, appointments, invoices, expenses). Fixed a `with_check`→`with check` syntax bug in `20260713000005_code_review_b4_rls_performance.sql` (18 occurrences) that would have blocked `db reset` outright. Verified read-only via Supabase MCP against remote: 67/67 functions, 35/35 tables, 14/14 enums, RLS `permissive` flags all match. `supabase db reset` E2E still blocked — no Docker in this sandbox (`npx supabase start` → "Cannot connect to the Docker daemon"); needs a Docker-enabled env/CI to run once. See Discrepancies D-01. |
| 2026-07-23 | P0.2 | **Done.** Committed `supabase/config.toml` (Auth: custom access token hook enabled pointing at `public.custom_access_token_hook`, owner MFA/TOTP enabled, JWT expiry 7 days per D12, local email/inbucket for magic-link + invite testing). |
| 2026-07-23 | P0.3 | **Done.** Added [`supabase/seed.sql`](../../supabase/seed.sql): idempotent upsert (`on conflict` by `plans.code` / `plan_entitlements(plan_id, feature_key)`, never by generated id) seeding all 4 plans with `limits_json` (PRD §4.2/D8/D22) and the full 21-feature-key × 4-plan entitlement matrix (PRD §4.3/D42) — 84 rows. Values pulled **read-only via Supabase MCP `execute_sql`** from the live `phase1_plans_and_entitlements` data (zero writes to remote) and cross-checked programmatically against `lib/entitlements/features.ts` `FEATURE_KEYS`: exact match, no missing/extra/duplicate keys, no value mismatches across all 4 plans. Added a `do $$ ... $$` post-seed assertion (21 entitlement rows per plan) so a future drift fails `db reset` loudly instead of seeding silently incomplete data. Flipped `supabase/config.toml` `[db.seed] enabled = true` now that `./seed.sql` exists. **Residual gap** (shared with P0.1/D-01): cannot execute `supabase db reset` end-to-end in this sandbox — no Docker/Postgres available. Verified statically (SQL structure read-through, Python cross-check script comparing seed rows to remote-fetched matrix) but not run live; needs a Docker-enabled env/CI to confirm `db reset` seeds cleanly. |
| 2026-07-23 | P0.4 | **Done.** [`package.json`](../../package.json): added `"test:unit": "vitest run --exclude \"lib/security/**\""` (the other 14 `*.test.ts` files, verified `14 passed / 59 tests` with **no** `.env.local` and no Supabase env vars present — confirmed no live DB needed); kept `"test:security"` as the existing 2-file allowlist; changed `"test"` from bare `vitest run` to `"npm run test:unit && npm run test:security"` so it explicitly runs unit+security (security auto-skips today if DB env absent — hardening that skip is P0.8). **Bug found + fixed along the way** (tracked as D-15 update): both security test files destructured `env!` directly in the `describe(...)` body, which vitest always executes even under `describe.skip` — with no DB configured this threw a `TypeError` (file failure) instead of skipping cleanly. Fixed by moving the destructure into `beforeAll` in [`lib/security/tenant-isolation.test.ts`](../../lib/security/tenant-isolation.test.ts) and [`lib/security/rbac-and-lifecycle.test.ts`](../../lib/security/rbac-and-lifecycle.test.ts). Verified: no-env run now reports `2 skipped (2)`, exit 0. Confirmed via `git stash` that the bug pre-existed my changes; confirmed via `npx tsc --noEmit` that pre-existing type errors in those 2 files (Supabase generic/`ws` typing) are unrelated/unchanged by this edit. Did **not** attempt a live `test:security` run against the remote project configured in `.env.local` (`pcfroikqbjvwweeidgar.supabase.co`, the same project used elsewhere in this session) — sandbox has no network route to it (`ENOTFOUND`), and running it for real would create live auth users/clinics against what appears to be the only configured project, not a dedicated staging one; that full DB run should happen in P0.7 (local Supabase CLI) instead. Updated [`Discrepancies.md`](./Discrepancies.md) D-05 and D-15. |
| 2026-07-23 | P0.5 | **Done.** Installed `@vitest/coverage-v8@4.1.10` (pinned to match `vitest@4.1.10`). [`vitest.config.ts`](../../vitest.config.ts): added `test.coverage` (`provider: v8`, reporters `text`/`html`/`lcov` → `./coverage`, already gitignored) scoped to `include: ["lib/**/*.ts"]` — excludes `*.test.ts` and `lib/security/test-env.ts` — since that's where all unit-testable business logic lives (`app/`/`components/` are Playwright's job). Added `"test:coverage"` npm script mirroring `test:unit`'s DB-free scope (`vitest run --exclude "lib/security/**" --coverage`). **Threshold correction vs plan text:** measured actual coverage before picking a number — `npm run test:coverage` shows **10.34% statements** (401/3875), not the ≥40% this row assumed; most of `lib/` is `actions.ts`/`rbac.ts`/`gate.ts` files at 0% because they need INT/security tests (P1–P4), not pure unit tests, to exercise. Set `thresholds.statements = 10` (just under measured, so it fails on regressions, not on the pre-existing gap) rather than shipping a threshold that's red on day one. Verified: `npm run test:coverage` exits 0 today; manually forcing `--coverage.thresholds.statements=40` reproduces a real `exit 1` failure, confirming the gate is live, not decorative. Full detail + rationale in [Discrepancies.md](./Discrepancies.md) D-19. P5.2 (raise to ≥60%) still stands as the long-term target once P1–P4 add INT coverage for the 0%-covered files. |
| 2026-07-23 | P0.6 | **Done.** Added [`.github/workflows/unit.yml`](../../.github/workflows/unit.yml): new workflow (checkout → setup-node@20 → `npm ci` → `npm run test:unit`) on `push: [main]` + every `pull_request`, mirroring the existing `security.yml`/`e2e.yml` steps but with **zero `env:`/secrets** — matches P0.4's confirmed no-DB scope. Verified locally: `npm run test:unit` → `14 passed / 59 tests`, exit 0, no `.env.local`/Supabase env vars in the shell. Validated workflow YAML parses (`js-yaml`). Updated Discrepancies D-05 (unit-tests-not-in-CI) to resolved; P0.7 (local Supabase in CI for `test:security`) remains the only open item in that discrepancy. |
| 2026-07-23 | P0.7 | **Done (written; execution pending Docker-enabled runner).** Rewrote [`.github/workflows/security.yml`](../../.github/workflows/security.yml): dropped the remote-secrets `env:` block entirely and replaced it with `supabase/setup-cli@v1` → `supabase start` → `supabase db reset` → `supabase status -o env --override-name ...` (mapping local-stack `api.url`/`auth.anon_key`/`auth.service_role_key` directly onto the 3 vars `lib/security/test-env.ts` reads: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) → `npm run test:security`. Matches the plan's "prefer local over remote staging" principle and Test-Strategy.md's target harness; no repo secrets required for this job anymore. Confirmed the exact `--override-name` key syntax (`api.url`, `auth.anon_key`, `auth.service_role_key`) against `supabase status --help` (installed CLI 2.109.1) and the CLI source (`internal/status/status.go` `CustomName` struct) — `anon_key`/`service_role_key` are marked deprecated upstream (in favor of publishable/secret keys) but still emitted and still match what this codebase's Supabase client/tests actually use, so kept them rather than migrating key styles as an unrelated change. Validated workflow YAML parses (`js-yaml`). **Residual gap (same root cause as D-01/P0.1):** this sandbox has no Docker (`docker: command not found`), so `supabase start`/`db reset`/the resulting `test:security` run against local Postgres could **not** be executed end-to-end here — only YAML/syntax-level verification was possible. **Action for a Docker-enabled environment (e.g. actual GitHub Actions runner)**: first real PR run of this workflow is the live verification; if `supabase start` or `db reset` fails, that's a P0.1 schema issue, and if env export/test wiring fails, report exact step + error here. |
| 2026-07-23 | P0.8 | **Done.** [`lib/security/test-env.ts`](../../lib/security/test-env.ts) `getSecurityTestEnv()` now throws (instead of returning `null`) when `SECURITY_TESTS_REQUIRED=1` and any of `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` is missing, naming the missing var(s). Since both security test files call it at `describe`-body top level (not inside `beforeAll`), the throw happens at module load, so the whole file reports **failed**, not skipped — verified live: `SECURITY_TESTS_REQUIRED=1` + `.env.local` moved aside → `2 failed`, real process `exit 1`; no flag + no env → clean `2 skipped`, `exit 0`. Refactored the function to accept an optional `source` param (defaults to `process.env`) purely so the branch matrix (missing/present × flag on/off) is unit-testable without mutating real env or touching `.env.local` — added [`lib/security/test-env.test.ts`](../../lib/security/test-env.test.ts) (6 tests, all DB-free). Narrowed `test:unit`/`test:coverage`'s `--exclude` in [`package.json`](../../package.json) from the whole `lib/security/**` directory to just the two DB-dependent files, so the new test-env test runs under `test:unit` (verified: `15 passed / 65 tests`, up from `14/59`). Wired [`.github/workflows/security.yml`](../../.github/workflows/security.yml) to set `SECURITY_TESTS_REQUIRED: "1"` on the `test:security` step, so the gate is actually live in CI (not just available), not merely documented in the Verification command blocks above. Updated Discrepancies D-05 and D-15 to resolved. |
| 2026-07-23 | P0.9 | **Done.** Added [`lib/security/factories.ts`](../../lib/security/factories.ts): single shared module for the "auth user + clinic + profile via service role" pattern that was duplicated (and drifting — different cleanup fallback table lists per file) across `lib/security/tenant-isolation.test.ts` (`createTestClinic`), `lib/security/rbac-and-lifecycle.test.ts` (`createClinicUser`) and `e2e/helpers/seed.ts` (`createSeededUser`). Exports `createClinicWithRoles()` (creates one clinic — or reuses an existing `clinicId` — plus one profile per requested `AppRole`, in one call; returns both an ordered `users[]` and a `byRole` lookup, so it covers "one clinic, one role" A/B tenant setups and "one clinic, every role" RBAC matrix setups without two different helpers) plus the supporting primitives (`createSupabaseClient`, `randomTag`, `signInAs`, `createAuthUser`, `resolvePlanId`, `createPatient`, `createServiceRow`) and a unified `cleanupClinics()` teardown (superset of every fallback table the 3 duplicates used: `gdpr_erasure_requests`, `clinic_operators`, `clinic_invites`, `clinic_locations`, `patients`, `audit_events`, `clinic_subscriptions`, `profiles`, `clinics`, then auth users). Refactored both security test files to thin wrappers (`createTestClinic`/`createClinicUser`) over the shared factory so every existing call site and assertion stayed unchanged. Refactored `e2e/helpers/seed.ts` to delegate to the same factory while keeping its public API (`createSeededUser`, `seedOperationalClinic`, `cleanupSeededUsers`, `createPatient`, `createService`, `SeededUser`/`SeededClinic` types) untouched, and `e2e/helpers/supabase.ts` to delegate `createServiceClient`/`createAnonClient`/`signInAs`/`randomTag` to the shared primitives instead of its own copy. Used relative imports (not the `@/*` tsconfig alias, which `tsconfig.json` excludes for `e2e/`) so the module resolves identically from Vitest and Playwright. Verified: `npm run test:unit` still `15 passed / 65 tests`; both security test files still report a clean `2 skipped` with no Supabase env and correctly attempt a real connection (network-blocked in this sandbox, not a regression — same as pre-existing P0.4/P0.7 gap) once `.env.local` is present; `npx tsc --noEmit` shows the exact same 2 pre-existing Supabase-generic/`ws`-typing errors, now deduplicated into `factories.ts` alone instead of duplicated across 2 files; a temporary `e2e`-scoped `tsconfig` confirmed zero new type errors in `e2e/helpers/**`; `eslint` clean on all 5 touched files. |
| 2026-07-23 | P0 exit criteria | **Verified & closed.** All 5 exit criteria checked. Confirmed via `gh run list`/`gh run view --log` (no local re-implementation needed — P0.1–P0.9 were already done) that the latest `main` push (commit `37a4927`, run [`30048179856`](https://github.com/ZijadLejlic/ordinacijaOS/actions/runs/30048179856)) is green end-to-end on a real Docker-enabled GitHub Actions runner: `security.yml` → `supabase start` → `supabase db reset` (seeds `supabase/seed.sql`) → `npm run test:security` with `SECURITY_TESTS_REQUIRED=1` → `2 passed (2)` / `21 passed (21)`; `unit.yml` → `npm run test:unit` → `15 passed (15)` / `65 passed (65)`, no secrets. Re-ran `npm run test:unit` locally too: still `15/65` green. Local sandbox still has no Docker (`docker not found`, confirmed even with unrestricted permissions), so `supabase start && supabase db reset` cannot be reproduced from *this* machine — that residual is inherent to the sandbox, not a gap in the harness, since the actual CI runner proves it. Flipped Discrepancies.md **D-01** and **D-05** from partial to **RESOLVED 2026-07-23** with the run evidence. **P0 is done — ready to start P1.** |
| 2026-07-24 | P1.1 | **Done (written; execution pending Docker-enabled runner).** Added [`lib/security/tenant-isolation-expanded.test.ts`](../../lib/security/tenant-isolation-expanded.test.ts): expands tenant isolation from the original 4 tables (profiles/audit/patients/appointments/storage in `tenant-isolation.test.ts`) to every remaining clinic-scoped table per Test-Strategy §4.1 — closes `TEN-RLS-010` (invoices/invoice_lines/payments/payment_plans+installments), `TEN-RLS-011` (expenses), `TEN-RLS-012` (treatment_plans/treatment_plan_items), `TEN-RLS-013` (email_templates/outbound_messages/crm_notifications), `TEN-RLS-014` (inventory_items/consent_forms/consent_signatures), `TEN-RLS-015` (clinic_locations/clinic_invites), and `TEN-SEC-002` (forged-`clinic_id` INSERT rejected by `WITH CHECK`, probed on invoices/expenses/treatment_plans/clinic_locations/clinic_invites — patients already covered in the original file). Verified read-only via Supabase MCP `list_tables` (verbose) that every one of these tables already has `rls_enabled: true` and, by reading the actual migration SQL (`20260713240000_phase2d_invoices.sql`, `20260713250000_phase2e_expenses.sql`, `20260713220000_phase2b_treatment_plans.sql`, `20260714000000_phase3b_crm_light.sql`, `20260713300000_phase3a_email_templates.sql`, `20260714050100_phase3d_consent_draw_sign.sql`, `20260714060000_phase3e_inventory_basic.sql`, `20260712900001_phase1_foundation.sql`), that every SELECT/INSERT/UPDATE policy on them already gates on `clinic_id = current_clinic_id()` — so this phase is a **pure test-authoring task**, no product/RLS code changes were needed (unlike the optional P1.11 follow-up for D-02/D-03 style gaps). Picked per-table actor roles by reading each table's `can_access_*`/`can_write_*` RBAC helper function bodies so every negative assertion is unambiguously a tenant-isolation failure, not an unrelated RBAC gap: `accountant` for invoices/expenses (owner+accountant only, and using a non-owner role sidesteps the `owner_mfa_aal2` restrictive policies — that MFA path is P1.3's job, not P1.1's), `doctor` for treatment_plans/inventory/consent (in every relevant `can_access`/`can_write` list), `reception` for CRM/email (`can_access_crm`/`can_read_email_templates`/`can_send_outbound_messages` all include reception), `owner` only where the product itself restricts read to owner (`clinic_invites_select_owner`). Reused `lib/security/factories.ts` (`createClinicWithRoles`, `createPatient`, `cleanupClinics`, etc.) with zero changes — P0.9's shared-factory investment paid off directly here. Wired the new file into [`package.json`](../../package.json) (`test:security` now runs all 3 security files; `test:unit`/`test:coverage` exclude it same as the other 2) — no `security.yml` change needed since that workflow calls `npm run test:security`, not a hardcoded file list. Verified: `npx tsc --noEmit` clean; `npm run test:unit` still `15 passed / 65 tests` (new file correctly excluded); with `.env.local` present but this sandbox's network blocked (`ENOTFOUND pcfroikqbjvwweeidgar.supabase.co`, same root cause as every prior phase — see P0.1/P0.4/P0.7), `vitest run lib/security/tenant-isolation-expanded.test.ts` correctly *attempts* a real connection instead of silently skipping (proves `SECURITY_TESTS_REQUIRED`/`getSecurityTestEnv()` is wired the same as the other 2 files) but cannot complete end-to-end from this machine. **Action for a Docker-enabled environment**: first real `security.yml` run against this file is the live verification (13 new tests); if any assertion fails, that's either a genuine RLS gap (report table + exact policy) or a wrong actor-role assumption in this file, not a re-derivation needed from scratch. Flipped the `TEN-RLS-010..015`/`TEN-SEC-002` rows in [Test-Strategy.md](./Test-Strategy.md) §4.1 from GAP to COVERED. |
| 2026-07-24 | P1.2 | **Done (written; execution pending Docker-enabled runner).** Added [`lib/security/storage-isolation.test.ts`](../../lib/security/storage-isolation.test.ts) — closes `FILE-RLS-002`, `FILE-SEC-001`, `FILE-SEC-003`. First read every storage bucket + policy that actually exists (not assumed): grepped `supabase/migrations/**` for `storage.buckets`/`storage.objects` and found there are only **two** buckets in the whole schema, both created with `public = false` — `clinic-branding` (`20260713270000_phase2g_branding.sql`, path `{clinic_id}/logo.webp`, write gated by `is_clinic_owner()`) and `patient-files` (`20260713210000_phase2a_clinical_core.sql`, generic path `{clinic_id}/{patient_id}/documents\|images\|consents/...` gated by `can_access_patients()`/`can_write_patients()`, plus an invoice-specific overlay policy in `20260713240000_phase2d_invoices.sql` for `foldername[3]='invoices'` gated by `can_access_invoices()`/`can_write_invoices()`). Cross-checked `lib/patients/storage.ts` (`consentPdfPath`/`consentSignaturePath` → `{clinic_id}/{patient_id}/consents/...`) and confirmed there is **no** consent-specific storage policy — signed consent PDFs/signatures fall under the same generic `patient_files_*` policies as documents/images, so one consent-PDF test covers that path family (documented in the file's header instead of duplicating a redundant `.sig.png` test). Since both existing buckets are private with correctly-scoped policies, **FILE-SEC-001 "public list buckets" required no product-behavior exception** — there is no bucket in this schema that is intentionally public (verified by reading every `insert into storage.buckets` statement, not guessed), so the anon tests assert plain denial/empty everywhere rather than special-casing a public logo bucket. Test pattern mirrors `tenant-isolation.test.ts`'s existing storage test: service-role uploads into Clinic B's folder, then a signed-in Clinic A user (using a role that legitimately has *some* write access to that folder type — `owner` for branding, `doctor` for consents, `accountant` for invoices — so a denial is unambiguously the `{clinic_id}/...` tenant check, not an unrelated RBAC gap) attempts upload/list/download and must be denied. For `FILE-SEC-003`, read `app/api/invoices/[invoiceId]/pdf/route.ts`: a dedicated route **already exists** and already double-gates (explicit `.eq("clinic_id", profile.clinic_id)` filter *and* the underlying `invoices`-table RLS both would independently block cross-clinic access, plus a `canAccessInvoices()` role check) — this was a test-authoring task, not a bug fix. The route resolves its Supabase client via `@/lib/supabase/server`, which needs `next/headers` cookies only available inside a real Next.js request — no test in this repo calls an `app/api/**/route.ts` handler directly yet, so this establishes that pattern: `vi.mock("@/lib/supabase/server", ...)` swaps *only* the cookie-session plumbing for a lazily-read already-authenticated (or anonymous) real Supabase client obtained the same way every other security test gets one (`signInAs`/`createSupabaseClient` against local Supabase Auth) — the route's own logic and the real RLS/Storage behind it are untouched. Added 4 API-level cases: clinic A accountant + clinic B's invoice id → `404` (IDOR), clinic A accountant + clinic A's own invoice id → `200` with byte-identical PDF (positive control proving the harness isn't trivially returning errors for everything), clinic A doctor (no invoice RBAC) → `403`, no session → `401`. Wired the new file into [`package.json`](../../package.json) `test:security`/`test:unit`/`test:coverage` exactly like P1.1's file. Verified: `npx tsc --noEmit` clean; `npx eslint lib/security/storage-isolation.test.ts` clean; `npm run test:unit` still `15 passed / 65 tests` (new file correctly excluded). Ran the new file standalone (`npx vitest run lib/security/storage-isolation.test.ts`) as an extra import-time sanity check beyond what P1.1 did: with `.env.local` present the suite correctly *attempted* a real `auth.admin.createUser` call against the configured remote project and failed only with `ENOTFOUND pcfroikqbjvwweeidgar.supabase.co` — the same pre-existing sandbox-network limitation as every prior phase (P0.1/P0.4/P0.7/P1.1), confirming the file (including the `sharp`-importing `lib/patients/storage.ts` chain pulled in via the mocked route module) loads and wires correctly with zero import-time errors. No RLS gap found — this phase required no product/migration changes. **Action for a Docker-enabled environment**: first real `security.yml` run against this file is the live verification (12 new tests); if the `FILE-SEC-003` route-level cases fail specifically, check first whether it's the `vi.mock` harness (new pattern, no prior precedent in this repo) rather than the route itself. Flipped `FILE-RLS-002`/`FILE-SEC-001`/`FILE-SEC-003` in [Test-Strategy.md](./Test-Strategy.md) §4.1 from GAP/PARTIAL to COVERED. **Residual (not fixed in this pass, flagged for whoever does a docs-consistency sweep):** `Threat-Model.md` T-TEN-04 and `Traceability-Matrix.md` D21/§8.1 still cite the older `FILE-RLS-001`/PARTIAL wording — Test-Strategy.md's own catalog never actually had a `FILE-RLS-001` row (only `TEN-RLS-009` covers that patient-files case), so this is a pre-existing ID-drift between docs, not something this phase's scope (Test-Strategy.md + Implementation-Plan.md only, matching P1.1's precedent) touches. |
| — | P1.3 | pending |
| — | P1.4 | pending |
| — | P1.5 | pending |
| — | P1.6 | pending |
| — | P1.7 | pending |
| — | P1.8 | pending |
| — | P1.9 | pending |
| — | P1.10 | pending |
| — | P1.11 | pending |
| — | P2 | pending |
| — | P3 | pending |
| — | P4 | pending |
| — | P5 | pending |

---

*Implementation plan — DentOrd QA — 2026-07-23.*
