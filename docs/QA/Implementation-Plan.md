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

- [ ] Fresh clone: `supabase start && supabase db reset` succeeds with zero stub-only migrations blocking schema.
- [ ] `npm run test:unit` green in CI without Supabase secrets.
- [ ] `npm run test:security` green against **local** Supabase in CI (or documented staging fallback with secrets).
- [ ] Skipping security tests in CI is impossible when `SECURITY_TESTS_REQUIRED=1`.
- [ ] Discrepancy **D-01** and **D-05** marked resolved in Discrepancies.md changelog note.

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
| — | P1 | pending |
| — | P2 | pending |
| — | P3 | pending |
| — | P4 | pending |
| — | P5 | pending |

---

*Implementation plan — DentOrd QA — 2026-07-23.*
