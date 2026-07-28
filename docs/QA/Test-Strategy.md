# DentOrd — Risk-Based Test Strategy

> Prioritized test catalog across unit, integration, DB, RLS, API/server-action, E2E, security, and regression.
> Every proposed test includes: requirement, risk, level, preconditions, expected result, priority.
> Status: `COVERED` | `PARTIAL` | `GAP`. Conventions: [README.md](./README.md).

---

## 1. Strategy overview

### 1.1 Goals

1. **Zero tenant-isolation regressions** in production (PRD KPI).
2. Prove **authz/RBAC** and **financial/PII integrity** independently of UI.
3. Keep **Critical E2E** (signup, appointment, invoice PDF) green on every release that touches those flows.
4. Move DB/RLS tests to **hermetic local Supabase** (Implementation P0).
5. Extend coverage without replacing Vitest / Playwright / Supabase stack.

### 1.2 Pyramid (target)

```text
        E2E (few, Critical journeys + isolation UI)
       /    \
   API / SA INT (RBAC matrix, money, GDPR, lifecycle)
     /        \
  RLS / DB SEC (tenant, triggers, EXCLUDE, MFA aal2)
 /              \
UNIT (parsers, money, entitlements, CSV, templates)
```

| Level | Owns | Approx. Critical+High count (target) |
|---|---|---|
| UNIT | Pure logic | ~25 (many COVERED) |
| DB / RLS / SEC | Hard security | ~60 |
| INT (actions) | App+DB contracts | ~80 |
| API | Downloads/cron/export | ~15 |
| E2E | Journeys | ~12 |

### 1.3 Regression gates (CI)

| Gate | Today | Target after P5 |
|---|---|---|
| Lint / typecheck | Manual/local | CI job |
| Unit Vitest (all `*.test.ts` except optional live) | **Not in CI** | Always |
| Security Vitest (RLS/RBAC) | `security.yml` (remote) | Local Supabase in CI |
| Playwright blockers | `e2e.yml` | Keep + expand High journeys |
| Migration reset smoke | None | `supabase db reset` in P0 |

---

## 2. Tooling recommendations

| Need | Recommendation | Rationale |
|---|---|---|
| Unit / INT | **Vitest** (keep) | Already configured; add coverage thresholds in P0 |
| E2E | **Playwright** (keep) | Already CI; Chromium sufficient for MVP |
| Local DB | **Supabase CLI** `supabase start` / `db reset` | Hermetic; matches prod Postgres+Auth+Storage |
| Pure SQL policy tests | Optional **pgTAP** via `supabase test db` | Only if Vitest RLS proves slow/flaky |
| HTTP mocks | **MSW** (add if needed) | Resend/PostHog/Sentry; do not mock Supabase for RLS tests |
| TOTP in E2E | **otpauth** (keep) | Already in `e2e/helpers/mfa.ts` |
| Do **not** replace | Jest, Cypress, Playwright→Selenium, etc. | No strong reason |

Env for hermetic CI (future): local Supabase URL + anon + service_role from `supabase status`.

---

## 3. Fixtures, seed data, mocks, test users

### 3.1 Canonical users (per clinic)

| Alias | Role | Notes |
|---|---|---|
| `owner@…` | owner | MFA enrolled; TOTP secret in fixture vault |
| `doctor@…` | doctor | No MFA |
| `doctor2@…` | doctor | For peer-amount / scope tests |
| `assistant@…` | assistant | Shared desk candidate |
| `reception@…` | reception | Shared desk + operators |
| `accountant@…` | accountant | Finance only |
| `inactive@…` | doctor | `is_active=false` |

Emails pattern (existing): `security-test-{tag}@ordinacijaos.test`, `e2e-{role}-{tag}@ordinacijaos.test`, `rbac-{role}-{tag}@ordinacijaos.test`.

### 3.2 Clinics

| Alias | Plan | Purpose |
|---|---|---|
| Clinic A | professional | Happy path |
| Clinic B | professional | Isolation peer |
| Clinic Starter | starter | Limit + entitlement denial |
| Clinic Readonly | professional | `status=readonly` |
| Clinic Demo | professional + `is_demo` | Lifecycle skip |

### 3.3 Factories (extend existing)

| Helper (today) | Extend to |
|---|---|
| `e2e/helpers/seed.ts` | Locations, invoices, payments, waitlist, CRM rows, inventory, consent |
| `lib/security/*` setup | Shared `createClinicWithRoles()` factory used by Vitest + Playwright |
| `scripts/seed-demo-clinic.ts` | Keep for sales; **not** for CI isolation (readonly demo) |

### 3.4 Deterministic domain fixtures

- Patient: Ana / Marko with `+387…` phones
- Service: 30 min, €50, VAT 0 or 17
- Appointment: fixed `starts_at` in `Europe/Sarajevo`
- Invoice: one line → known net/VAT
- Operator: display name + PIN `2468`

### 3.5 Mocks

| Dependency | Mock strategy |
|---|---|
| Resend | Stub module / env missing → assert “would send” or capture payload in test double |
| PostHog | No-op; assert event shape in unit tests |
| Sentry | No-op |
| Stripe | N/A until Faza 4 |
| `sharp` | Optional; or run real convert in INT with small PNG |
| Cron | Call `runClinicLifecycleJob` directly in INT; API tests hit route with secret |

### 3.6 Secrets in tests

Never commit real service role for production. CI uses staging **or** local Supabase keys. Document rotation in Production-Ops.

---

## 4. Test catalog

Format per row: **ID** · Requirement · Risk · Level · Preconditions · Expected · Priority · Status

### 4.1 Critical — release blockers

#### Tenant isolation

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| TEN-RLS-001 | D7 §8.1 | Cross-clinic profiles leak | RLS | Clinics A/B doctors | A cannot SELECT B profiles | Critical | COVERED |
| TEN-RLS-002 | D7 | Audit cross-clinic | RLS | A/B | A cannot SELECT B audit | Critical | COVERED |
| TEN-RLS-007 | D7 §6.2 | Patient PHI leak | RLS | A/B patients | A cannot read B patients | Critical | COVERED |
| TEN-RLS-008 | D7 §6.5 | Appointment leak | RLS | A/B appts | A cannot read B appts | Critical | COVERED |
| TEN-RLS-009 | D21 | Storage cross-clinic | RLS | file in B path | A cannot list/download B `patient-files` | Critical | COVERED |
| TEN-E2E-001 | §12.2 | UI IDOR | E2E | A/B patients | B patient 404 / hidden in list | Critical | COVERED |
| TEN-RLS-010 | D7 | Cross-clinic invoices | RLS | invoice in B | A cannot read/write | Critical | COVERED |
| TEN-RLS-011 | D7 | Cross-clinic expenses | RLS | expense in B | denied | Critical | COVERED |
| TEN-RLS-012 | D7 | Cross-clinic treatment plans | RLS | plan in B | denied | Critical | COVERED |
| TEN-RLS-013 | D7 | Cross-clinic CRM/email | RLS | rows in B | denied | Critical | COVERED |
| TEN-RLS-014 | D7 | Cross-clinic inventory/consent | RLS | rows in B | denied | Critical | COVERED |
| TEN-RLS-015 | D7 | Cross-clinic locations/invites | RLS | rows in B | denied | Critical | COVERED |
| TEN-SEC-002 | D7 | INSERT with forged clinic_id | SEC | A JWT | WITH CHECK rejects | Critical | COVERED |
| FILE-RLS-002 | D21 | Upload to other clinic folder | RLS | A JWT | storage policy denies | Critical | COVERED |
| FILE-SEC-001 | D21 | Public list buckets | SEC | anon | empty / denied | Critical | COVERED |
| FILE-SEC-003 | D21 FIN | Invoice PDF path IDOR | API | A session, B invoice id | 403/404 | Critical | COVERED |

#### Auth / MFA / privilege

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| AUTH-RLS-002 | §3.4 D7 | Self-promote to owner | RLS | doctor JWT | role unchanged | Critical | COVERED |
| AUTH-DB-001 | D13 | Unlimited login brute force | DB | 5× `record_failed_login` | locked_until set; audit | Critical | COVERED |
| AUTH-E2E-003 | D11 | Owner without MFA reaches app | E2E | owner no factor | redirect `/mfa/enroll` | Critical | COVERED |
| AUTH-RLS-001 | D11 | Owner aal1 writes | RLS | owner MFA enrolled, aal1 JWT | INSERT/UPDATE denied | Critical | COVERED |
| AUTH-SEC-001 | D9 | Invite token reuse | SEC | accepted token | second accept fails | Critical | COVERED |
| AUTH-SEC-002 | D10 | Cross-clinic PIN verify | SEC | op from B, user A | verify fails | Critical | COVERED |
| PLAT-SEC-003 | D41 | Service role in client | SEC | build/bundle grep or import graph | no service key in client chunks | Critical | COVERED |
| LIFE-API-001 | D6 D45 | Unauth clinic hard-delete cron | API | no/wrong secret | 401 | Critical | COVERED |

#### Finance integrity

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| FIN-SEC-001 | D29 | Allocate number for other clinic | SEC | A JWT, `allocate(B)` | `forbidden_clinic` | Critical | COVERED |
| FIN-RLS-001 | D29 | DELETE payments / lines | RLS | finance writer | DELETE denied | Critical | COVERED |
| FIN-E2E-001 | §12.2 | Broken invoice PDF path | E2E | accountant seed | PDF magic `%PDF` | Critical | COVERED |
| FIN-DB-001 | D29 | Concurrent duplicate numbers | DB | parallel allocate | unique serials | Critical | COVERED |

#### PII / GDPR / lifecycle

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| PII-RLS-001 | D35 | Erasure without owner | RLS | doctor request; accountant approve | only owner approve; patient gone | Critical | COVERED |
| PII-INT-001 | D35 | Partial hard delete | INT | patient with docs/images/invoices | all subtree + storage gone; audit | Critical | COVERED |
| LIFE-RLS-001 | D6 | Writes in readonly | RLS + INT/SA | clinic readonly / pending_delete | RLS patient INSERT fails; SA `getClinicWriteBlock` → `clinicReadonly` / `clinicPendingDelete` across gated modules | Critical | COVERED |
| LIFE-SEC-002 | D45 W8 | Demo clinic deleted | SEC | is_demo clinic pending_delete | hard_delete refuses | Critical | COVERED |
| MKT-SEC-001 | W13 | Leads readable by users | RLS | authenticated JWT | SELECT/INSERT denied | Critical | COVERED |

#### Plan hard limits (Critical subset)

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| PLAN-DB-001 | D8 | Over user seats via invite | DB | starter at cap | `plan_limit_users` | Critical | COVERED |
| PLAN-DB-002 | D8 | 3rd location on Pro | DB | 2 active locations | `plan_limit_locations` | Critical | COVERED |
| PLAN-DB-003 | D8 | 6th doctor on Pro | DB | 5 doctors + doctor invite | `plan_limit_doctors` | Critical | GAP |
| FILE-DB-001 | D22 | Image limit bypass via INSERT | DB | at plan cap | deny (`plan_limit_images`) + SA block | Critical | COVERED |
| PLAN-SEC-001 | D42 | Feature table insert without entitlement | SEC | starter + inventory INSERT | document fail/gap; prefer deny | Critical | COVERED |

---

### 4.2 High — core journeys & money/clinical correctness

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| AUTH-E2E-001 | D4 D43 §12.1 | Broken onboarding | E2E | fresh signup | MFA + onboarding step 1 OK | High | COVERED |
| AUTH-E2E-002 | D9 | Staff cannot join | E2E | owner invite | accept → role correct | High | GAP |
| AUTH-INT-001 | D4 D46 D47 | Wrong trial/defaults | INT | signup | trial_ends_at 2026-12-31; TZ/phone defaults | High | GAP |
| AUTH-INT-010 | D9 D8 | Invite over limit | INT | at user cap | assertCanInviteStaff blocks (+ createInviteAction `userLimit`) | High | COVERED |
| AUTH-INT-011 | D10 | PIN audit missing | INT | create+switch | audit operator_id set | High | PARTIAL |
| AUTH-INT-020 | D12 | Force logout ineffective | INT | owner forces user | sessions revoked (per-user; non-owner deny; deactivate soft+revoke) | High | COVERED |
| CAL-E2E-001 | D14 §12.2 | Double booking | E2E | overlapping slot | error toast | High | COVERED |
| CAL-DB-001 | D14 | EXCLUDE bypass via RPC | DB | overlapping INSERT | exclusion violation | High | COVERED (via E2E/DB) |
| CAL-INT-001 | D15 | Wrong default duration | INT | service 30m | ends_at = start+30m | High | GAP |
| CAL-INT-003 | D25 | Waitlist not offered | INT | cancel + matching wait | notification/offer created | High | GAP |
| CAL-INT-004 | §3.2 | Doctor edits peer calendar | INT | doctor A vs B | forbidden (SA) + RLS deny | High | COVERED |
| RBAC-INT-005 | §3.2 | Doctor peer calendar (SA) | INT | doctor A vs B appt | forbidden — same suite as CAL-INT-004 | High | COVERED |
| FIN-INT-001 | D29 | Wrong serial format | INT | create invoice | `YYYY-####` | High | COVERED |
| FIN-INT-003 | D29 | Payment status wrong | INT | partial then full pay | unpaid→partial→paid | High | COVERED |
| FIN-INT-004 | D29 | Void still payable | INT | void invoice | payments rejected (SA `invoiceVoid`; DB INSERT residual noted) | High | COVERED |
| FIN-INT-010 | D29 D42 | Installments on Starter | INT | starter entitlements | feature blocked | High | GAP |
| FIN-INT-015 | D29 D-08 | Legal settings gates | INT | owner writable / readonly / accountant | settingsSaved; clinicReadonly; forbidden | High | COVERED |
| FIN-API-001 | D29 | PDF without finance role | API | doctor session; no session | 403; unauth 401 (FILE-SEC-003 + matrix) | High | COVERED |
| FIN-API-002 | D29 | Excel without feature/role | API | reception / starter; no session | 403; unauth 401 (matrix) | High | COVERED |
| FIN-INT-020 | D17 | Peer amounts leak | INT | setting false; 2 doctors | doctor sees only own | High | COVERED |
| PII-API-001 | §8.2 | Patient export open | API | accountant; no session | 403; clinical OK; unauth 401 | High | COVERED |
| PII-API-002 | §8.3 | Clinic ZIP non-owner | API | doctor; no session | 403; owner ZIP OK; unauth 401 | High | COVERED |
| PLAT-API-001 | Ops | Health env leak / deny | API | no secret vs Bearer CRON_SECRET | public `{ok}` only; detailed checks only with secret | High | COVERED |
| PLAT-API-002 | Ops | Sentry-test in prod | API | NODE_ENV=production | 404; non-prod + DSN → 200 | High | COVERED |
| MKT-API-001 | §7 | OG image requires auth | API | no session | 200 image (intentionally public) | High | COVERED |
| LIFE-INT-001 | D45 | Non-owner closes clinic | INT | doctor | request_clinic_closure fails | High | COVERED |
| LIFE-INT-002 | D6 | Grace transition wrong | INT | readonly past grace | pending_delete | High | COVERED |
| RBAC-RLS-001 | §3.2 | Finance RBAC wrong | RLS | O/C vs D/R | can_write_invoices matrix | High | COVERED |
| RBAC-RLS-002 | §3.2 | Clinical RBAC wrong | RLS | O/D vs C | patients/odontogram | High | COVERED |
| RBAC-RLS-003 | §3.2 | Front desk RBAC wrong | RLS | R vs C/D | appointments/waitlist | High | COVERED |
| RBAC-RLS-004 | §3.2 | Owner-only email/import | RLS | roles | templates owner; import O/C | High | COVERED |
| RBAC-RLS-005 | §6.15 | Audit non-owner | RLS | doctor | SELECT empty/denied | High | COVERED |
| RBAC-INT-001 | §3.2 | Patients SA RBAC miss | INT | doctor createPatient | allow (redirect) | High | COVERED |
| RBAC-INT-002 | §3.2 | Accountant writes patients | INT | accountant createPatient | forbidden | High | COVERED |
| RBAC-INT-003 | §3.2 / D-09 | A/R patient write (code) | INT | assistant+reception create | allow (code truth) | High | COVERED |
| RBAC-INT-004 | §3.2 | Odontogram SA RBAC | INT | doctor allow / reception deny | tooth upsert | High | COVERED |
| RBAC-INT-006 | §3.2 | Invoice SA RBAC | INT | accountant allow / doctor deny | createInvoice | High | COVERED |
| RBAC-INT-007 | §3.2 | Expense SA RBAC | INT | accountant allow / reception deny | createExpense | High | COVERED |
| RBAC-INT-008 | §3.2 | CRM SA RBAC | INT | reception past-RBAC / doctor deny | dismissCrm | High | COVERED |
| RBAC-INT-009 | §3.2 | Email template write | INT | owner allow / reception deny | updateTemplate | High | COVERED |
| RBAC-INT-011 | §3.2 | Assistant calendar write | INT | assistant createAppointment | allow | High | COVERED |
| RBAC-INT-012 | §3.2 | GDPR request SA | INT | doctor allow / accountant deny | requestErasure | High | COVERED |
| RBAC-INT-013 | §3.2 | GDPR manage SA | INT | owner past-RBAC / doctor deny | rejectErasure | High | COVERED |
| RBAC-INT-014 | §3.2 | Branding SA RBAC | INT | owner allow / doctor deny | updateColors | High | COVERED |
| RBAC-INT-015 | §3.2 | Treatment plan write | INT | doctor allow / assistant deny | createPlan | High | COVERED |
| RBAC-INT-016 | §3.2 | Import patients SA | INT | owner past-RBAC / doctor deny | importPatients | High | COVERED |
| RBAC-INT-017 | §3.2 | Calendar write SA | INT | reception allow / accountant deny | createAppointment | High | COVERED |
| RBAC-INT-018 | §3.2 | Consent form write | INT | doctor updateConsentForm | forbidden (owner write; PLAN-INT-011 owner allow) | High | COVERED |
| RBAC-INT-019 | §3.2 | Services CRUD SA | INT | doctor createService | forbidden | High | COVERED |
| RBAC-INT-020 | §3.2 | Locations SA | INT | doctor createLocation | forbidden | High | COVERED |
| RBAC-INT-021 | §6.12 | Inventory SA RBAC | INT | doctor allow / accountant deny | createItem | High | COVERED |
| RBAC-INT-022 | §3.2 | Invite create SA | INT | doctor createInvite | forbidden | High | COVERED |
| RBAC-INT-023 | §3.2 | GDPR approve SA | INT | doctor approveErasure | forbidden | High | COVERED |
| RBAC-INT-024 | D45 | Clinic closure SA | INT | doctor requestClinicClosure | forbidden | High | COVERED |
| RBAC-INT-025 | D29 | Void invoice SA RBAC | INT | doctor voidInvoice | forbidden | High | COVERED |
| RBAC-INT-026 | §3.2 | Waitlist SA RBAC | INT | doctor addWaitlist | forbidden (reception allow = PLAN-INT-011) | High | COVERED |
| RBAC-INT-027 | D43 | Onboarding SA RBAC | INT | doctor saveOnboardingClinic | forbidden | High | COVERED |
| PLAN-UNIT-002 | D3 D5 | Free period features on | UNIT | now < 2027-01-01 | SMS/AI/portal off | High | COVERED |
| PLAN-INT-011 | D42 | assertFeature bypassed in SA | INT | each Pro feature SA on starter | featureDisabled; pro allow | High | COVERED |
| CRM-INT-001 | D23 §12.1 | Reminder send broken | INT | owner template + send | outbound_messages row | High | GAP |
| IMP-INT-001 | D30 | Bad CSV committed | INT | dry-run errors | commit blocked; good rows OK | High | GAP |

---

### 4.3 Medium — secondary modules & negative paths

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| AUTH-UNIT-001 | D43 | Bad onboarding parse | UNIT | settings_json variants | grandfather/complete rules | Medium | COVERED |
| AUTH-UNIT-002 | D9 D10 | Weak PIN / token hash | UNIT | schemas | 4–6 digits; hash stable | Medium | COVERED |
| CAL-UNIT-001 | D25 | Wrong waitlist order | UNIT | priorities | FIFO+priority | Medium | COVERED |
| CAL-UNIT-002 | D47 | TZ range wrong | UNIT | Sarajevo | Mon–Sun / day bounds | Medium | COVERED |
| FIN-UNIT-001 | D29 | VAT math wrong | UNIT | gross | net+vat | Medium | COVERED |
| FIN-UNIT-002 | D29 | Excel corrupt | UNIT | sample rows | ZIP magic | Medium | COVERED |
| IMP-UNIT-001 | D30 | CSV mis-parse | UNIT | BOM/; quotes | mapped rows | Medium | COVERED |
| CRM-UNIT-001 | D23 | XSS in email HTML | UNIT | `{{ime}}` with HTML | escaped | Medium | COVERED |
| CRM-UNIT-002 | D24 | Birthday window wrong | UNIT | dates | due/null | Medium | COVERED |
| MKT-UNIT-001 | §4 | Wrong public prices | UNIT | MARKETING_PLANS | PRD §4.1/4.2/4.3 | Medium | COVERED |
| MKT-UNIT-003 | W13 | Invalid lead accepted | UNIT | Zod cases | reject honeypot/no consent | Medium | COVERED |
| PII-UNIT-002 | §8.2 | Consent storage broken | UNIT | localStorage mock | accept/reject | Medium | COVERED |
| PLAT-UNIT-001 | D41 | user_metadata admin spoof | UNIT | fake user | only app_metadata true | Medium | COVERED |
| PLAN-UNIT-001 | D8 D42 | limits parse wrong | UNIT | limits_json | numbers/null unlimited | Medium | COVERED |
| PLAN-UNIT-003 | D22 | Image assert wrong | UNIT | at cap | hard block | Medium | COVERED |
| PLAN-UNIT-010 | D2 | Branding parse | UNIT | json | colors/logo | Medium | COVERED |
| PII-INT-010 | D18 | Invalid FDI stored | INT | tooth 99 | rejected | Medium | GAP |
| PII-INT-011 | D19 | Bad plan status | INT | item statuses | enum enforced | Medium | GAP |
| PII-INT-012 | D20 | Consent PDF missing | INT | draw-sign | PDF+PNG paths | Medium | GAP |
| PLAN-INT-020 | D16 | Shared pricelist | INT | toggle on | services.location_id cleared | Medium | GAP |
| PLAN-INT-021 | §6.12 | Inventory low-stock | INT | qty≤threshold | badge/list flag | Medium | GAP |
| PLAN-INT-022 | §6.13 | Branding not applied | INT | colors set | branding_json persisted | Medium | GAP |
| CRM-INT-002 | D24 | CRM auto-send without human | INT | generate+send | send only via action | Medium | GAP |
| AUTH-INT-002 | D13 | Owner not notified on lock | INT | 5 fails | email or in-app event | Medium | GAP |
| AUTH-INT-021 | D12 | Session TTL ≠ 7d | INT/ops | Auth settings | matches D12 | Medium | GAP |
| TEN-SEC-003 | B5 | Stale JWT role | SEC | role changed | old JWT limited / re-login | Medium | GAP |
| TEN-SEC-004 | B5 | Hook off fallback | SEC | hook disabled | current_clinic_id still works | Medium | COVERED |
| FILE-INT-001 | D21 D22 | Non-image upload as image | INT | exe | rejected / converted | Medium | GAP |
| FILE-INT-011 | §6.13 | Branding upload ACL | INT | doctor | denied | Medium | GAP |
| IMP-INT-002 | D30 | Oversized CSV | INT | >1MB / >500 rows | rejected | Medium | GAP |
| MKT-INT-001 | W13 | Rate limit bypass | INT | 6 leads / hour same IP | 6th blocked | Medium | GAP |
| MKT-E2E-002 | §7 | Pricing CTA broken | E2E | marketing pages | CTA → signup | Medium | GAP |
| MKT-E2E-004 | §13.4 | Cookie banner missing | E2E | fresh browser | banner; PostHog gated | Medium | GAP |
| RBAC-INT-010 | §3.2 | Dashboard KPI overshare | INT | assistant session | canSeeDashboardKpis false; doctor true | Medium | COVERED |
| CAL-INT-005 | D14 | DnD without calendar_advanced | INT | starter/basic | blocked | Medium | GAP |

---

### 4.4 Low

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| MKT-E2E-001 | D37 | Locale/hreflang broken | E2E | /bs /hr /sr /en | 200 + hreflang | Low | GAP |
| MKT-E2E-003 | D40 | Mobile layout broken | E2E | mobile viewport | key screens usable | Low | GAP |
| CAL-E2E-002 | D40 | Calendar mobile unusable | E2E | day view mobile | no forced overflow | Low | GAP |
| TEN-SEC-001 | D51 | Cross-clinic switcher appears | SEC | v1 build | no membership UI | Low | GAP |
| PII-SEC-002 | D36 | Access-log feature exists | SEC | schema | no access_log table | Low | GAP |
| CRM-INT-003 | D44 | support@ wrong | INT | Resend from | brand constants | Low | GAP |
| MKT-INT-002 | W8 | Demo login broken | INT | demo credentials | opens is_demo clinic | Low | GAP |

---

### 4.5 Security-focused expansions (cross-cutting SEC level)

Already listed above where Critical. Additional:

| ID | Requirement | Risk prevented | Level | Preconditions | Expected result | Priority | Status |
|---|---|---|---|---|---|---|---|
| PII-SEC-001 | D33 | Patient name in analytics | SEC | track event helpers | payload keys allowlist | Critical | GAP |
| PLAT-INT-001 | D41 | Impersonation unaudited | INT | platform admin | audit start/stop rows | Critical | COVERED |
| PLAT-SEC-001 | D41 | user_metadata admin | SEC | crafted JWT claims in unit | rejected | Critical | COVERED (unit) |
| PLAT-SEC-002 | D41 | Sticky impersonation | SEC | stop then navigate | cookie cleared; platform only | High | GAP |
| AUTH-SEC-003 | D13 | Email enumeration | SEC | lockout RPC | generic error | Medium | GAP |
| MKT-SEC-002 | W13 | Honeypot bypass | SEC | bot field filled | rejected | Medium | COVERED (unit) |
| LIFE-SEC-001 | D34 | Non-EU project | SEC/ops | Production-Ops | checklist pass | Low | N/A auto |

---

## 5. Level-specific guidance

### Unit
- No network. Fast. Cover parsers, money, entitlements, CSV, templates, admin predicates.
- **CI:** run all pure unit files every PR (P0).

### DB
- Constraints, triggers, RPC grants, EXCLUDE, serial allocation under concurrency.
- Prefer local Supabase; service role for setup, authenticated clients for assert.

### RLS / SEC
- Pattern from `tenant-isolation.test.ts`: create A/B → signInAs → assert empty/error.
- Expand table matrix from [Business-Rules](./Business-Rules-and-RBAC.md) BR-T01.
- Never skip when env missing in CI (fail closed).

### Integration (server actions)
- Call actions with real session cookies or invoke underlying DB after SA module refactor for testability.
- Short term: test via Supabase client + shared validation; medium term: export inner functions.

### API
- Hit Route Handlers with `NextRequest` or Playwright `request` fixture.
- Cover: PDF, Excel, patient export, clinic ZIP, cron, health (secret vs public), og (public), sentry-test (prod deny). Matrix: `lib/security/api-routes-auth-matrix.test.ts` (P3.3).

### E2E
- Keep `workers: 1` until isolation-safe parallel seeds exist.
- One journey per Critical path; avoid duplicating RLS matrix in UI.

### Regression
- Tag `@blocker` for CI required suites.
- Flaky policy: quarantine with issue link; max 1 retry in CI (already configured).

---

## 6. Mapping to implementation phases

| Phase | Catalog focus |
|---|---|
| P0 | Harness; run units in CI; reproducible schema |
| P1 | All Critical TEN/AUTH/FILE/PLAN-SEC rows |
| P2 | FIN/PII/LIFE Critical+High |
| P3 | RBAC-INT full matrix + API |
| P4 | High E2E journeys + clinical INT |
| P5 | Medium/Low + marketing abuse + coverage thresholds |

Details: [Implementation-Plan.md](./Implementation-Plan.md).

---

*Test strategy — DentOrd QA — 2026-07-23.*
