# DentOrd — Requirements Traceability Matrix

> Maps every PRD requirement, Decision Log item (D1–D51), and §12 acceptance criterion to existing or proposed tests.
> Conventions: [README.md](./README.md). Status: `COVERED` | `PARTIAL` | `GAP` | `N/A`.

---

## 1. Decision Log (D1–D51)

| ID | Topic | Requirement (summary) | Test IDs | Status | Notes |
|---|---|---|---|---|---|
| D1 | Product | Greenfield DentOrd; Avicena reference only | — | N/A | Process / scope rule |
| D2 | MVP paket | Professional (25€/mj) + branding | `PLAN-UNIT-001`, `MKT-UNIT-001` | PARTIAL | Marketing prices + entitlements unit; no billing charge yet |
| D3 | Van MVP free | No AI / SMS / WhatsApp / patient portal | `PLAN-UNIT-002`, `PLAN-INT-011` | PARTIAL | Free-period override unit COVERED; Pro SA feature INT COVERED (PLAN-INT-011); free-period INT ID PLAN-INT-010 still GAP |
| D4 | Free trial | Self-signup; trial_ends_at ≤ 2026-12-31 | `AUTH-E2E-001`, `AUTH-INT-001` | PARTIAL | Signup E2E COVERED; trial date assert PARTIAL |
| D5 | Billing start | Stripe from 2027-01-01 | `PLAN-UNIT-002` | PARTIAL | Date constant unit only; Stripe N/A until Faza 4 |
| D6 | After free | 7d read-only → export → delete | `LIFE-RLS-001`, `LIFE-INT-001`, `LIFE-INT-002`, `LIFE-API-001` | COVERED | Writable + closure + grace→pending_delete + cron gate + SA write-block across modules COVERED |
| D7 | Tenant model | 1 user = 1 clinic; owner sees all locations | `TEN-RLS-001..009`, `TEN-E2E-001` | PARTIAL | Patients/appts/storage COVERED; not all tables |
| D8 | Pro limits | ≤5 doctors, ≤10 users, ≤2 locations; hard block | `PLAN-DB-001`, `PLAN-DB-002`, `PLAN-INT-001` | PARTIAL | Invite + location triggers COVERED; doctor seat edge GAP |
| D9 | Staff invites | Magic link → set password → role | `AUTH-E2E-002`, `AUTH-INT-010`, `AUTH-SEC-001` | PARTIAL | Token + SA seat gate COVERED; invite accept E2E still GAP |
| D10 | Shared desk PIN | Operators + PIN switch + audit | `AUTH-RLS-010`, `AUTH-INT-011`, `AUTH-SEC-002` | PARTIAL | PIN create/verify/lock/cross-clinic COVERED |
| D11 | 2FA | Owner MFA required; others not | `AUTH-E2E-003`, `AUTH-RLS-001`, `AUTH-E2E-001` | PARTIAL | MFA gate + enroll E2E COVERED; aal2 RLS write denial GAP |
| D12 | Session | TTL 7 days; owner force logout **per user** | `AUTH-INT-020`, `AUTH-INT-021` | PARTIAL | Force logout/deactivate COVERED (per-user D-07 product decision; D-22/D-23 fixed); TTL config still GAP (`AUTH-INT-021`) |
| D13 | Lockout | 5 fails → owner notify + temp lock | `AUTH-DB-001`, `AUTH-INT-002` | PARTIAL | Lock + audit COVERED; owner email notification GAP |
| D14 | Calendar | Doctor-bound; hard block overlap | `CAL-DB-001`, `CAL-E2E-001` | COVERED | EXCLUDE + E2E overlap |
| D15 | Duration | Default from service + manual | `CAL-INT-001` | GAP | Covered indirectly in create flow |
| D16 | Pricelist | Shared vs per-location toggle | `PLAN-INT-020`, `CAL-INT-002` | GAP | Action exists; no automated test |
| D17 | Peer amounts | Clinic setting doctors_see_peer_amounts | `FIN-INT-020`, `FIN-DB-001` | COVERED | RPC `dashboard_payment_stats`; default false |
| D18 | Odontogram | FDI; tied to visits/treatments | `PII-INT-010`, `PII-UNIT-001` | GAP | `is_valid_fdi` untested in suite |
| D19 | Treatment plan | planned/in_progress/done/cancelled | `PII-INT-011` | GAP | UI exists; no dedicated test |
| D20 | Consent sign | Draw signature on device | `PII-INT-012`, `FILE-INT-010` | GAP | Feature implemented; no automated test |
| D21 | Storage | Private + signed URLs; path clinic/patient | `FILE-RLS-001`, `FILE-SEC-001` | PARTIAL | patient-files isolation COVERED; branding/consent/invoice paths GAP |
| D22 | Image limits | Starter 10 / Pro 20 / … | `PLAN-UNIT-003`, `PLAN-INT-002`, `FILE-DB-001` | PARTIAL | Helper unit COVERED; DB/direct-insert bypass GAP |
| D23 | Email templates | Default BS/EN; clinic edits | `CRM-UNIT-001`, `CRM-INT-001` | PARTIAL | Render unit COVERED; edit/send INT GAP |
| D24 | CRM light | Birthday/recall/control; reception sends | `CRM-UNIT-002`, `CRM-INT-002` | PARTIAL | Birthday window unit COVERED |
| D25 | Waitlist | Auto-propose next on cancel | `CAL-UNIT-001`, `CAL-INT-003` | PARTIAL | Match algorithm unit COVERED |
| D26 | Online booking | Enterprise only | `PLAN-INT-010` | N/A | Out of MVP; assert feature off |
| D27 | Lab/technician | Enterprise only | `PLAN-INT-010` | N/A | Out of MVP |
| D28 | Fiscal cash | Not in app | — | N/A | Negative scope |
| D29 | Finance MVP | Invoices, VAT, serial, payments, debts, installments, expenses, Excel | `FIN-E2E-001`, `FIN-INT-001..015`, `FIN-API-001`, `FIN-API-002` | PARTIAL | Invoice+PDF E2E + PDF/Excel API + legal settings SA (FIN-INT-015) COVERED; installments GAP |
| D30 | Import | CSV patients + services | `IMP-UNIT-001`, `IMP-INT-001` | PARTIAL | Parse/map unit COVERED; commit INT GAP |
| D31 | AI later | Clinic-only; draft; opt-in | — | N/A | Faza 4 |
| D32 | Metered | SMS/WA/AI/storage +15% | — | N/A | Faza 4 |
| D33 | Analytics | PostHog without patient names | `PII-SEC-001`, `PII-UNIT-002` | GAP | Consent unit exists; PII payload audit GAP |
| D34 | Data residency | EU-only Supabase | `LIFE-SEC-001` | N/A | Ops checklist; not automated app test |
| D35 | GDPR delete | Hard delete with owner approval | `PII-RLS-001`, `PII-INT-001` | PARTIAL | Request/approve/hard-delete COVERED in rbac-and-lifecycle |
| D36 | Access log | No (change audit only) | `PII-SEC-002` | GAP | Negative: no access-log table/feature |
| D37 | Languages | BS default + HR/SR fallback + EN | `MKT-E2E-001` | GAP | Locale routing smoke |
| D38 | Marketing site | Full SEO/blog/pricing/signup | `MKT-E2E-002`, `MKT-UNIT-001` | PARTIAL | Plans matrix unit COVERED |
| D39 | Deploy model | Module → prod when ready | — | N/A | Process |
| D40 | Responsive | Full responsive required | `MKT-E2E-003`, `CAL-E2E-002` | GAP | Manual UAT today |
| D41 | Super-admin | Impersonation + audit; entitlements | `PLAT-UNIT-001`, `PLAT-INT-001`, `PLAT-SEC-001` | COVERED | isPlatformAdmin unit + impersonation audit INT COVERED; sticky cookie SEC still GAP |
| D42 | Entitlements | plans → features[] not UI-only | `PLAN-UNIT-001`, `PLAN-INT-011`, `PLAN-SEC-001` | COVERED | Features from DB + free override; Pro SA assertFeature INT COVERED (DB residual = D-03 waived) |
| D43 | Onboarding | In-app 3 steps | `AUTH-E2E-001` | PARTIAL | Step 1 COVERED; steps 2–3 GAP |
| D44 | Support | support@ Resend | `CRM-INT-003` | GAP | Ops / smoke |
| D45 | Clinic close | Export → 7d grace → hard delete | `LIFE-INT-001`, `LIFE-INT-002`, `PII-API-002`, `LIFE-SEC-002`, `LIFE-RLS-001` | COVERED | Closure + grace→pending_delete + demo skip + SA write-block COVERED (P2.6/P2.7/P3.6) |
| D46 | Phone default | +387; owner changeable | `AUTH-INT-001` | PARTIAL | Signup sets default; change GAP |
| D47 | TZ default | Europe/Sarajevo | `CAL-UNIT-002`, `AUTH-E2E-001` | PARTIAL | Calendar ranges unit COVERED |
| D48 | Annual sub | 2 months free (2027+) | — | N/A | Faza 4 |
| D49 | Buyer | Clinic owner | — | N/A | Persona |
| D50 | Security stance | Tool for records; doctor decides | — | N/A | Disclaimer / legal |
| D51 | Cross-clinic | v1 = 1 user 1 clinic | `TEN-SEC-001` | GAP | Negative: no membership switcher |

---

## 2. PRD feature specs (§6) → tests

| Req | Feature | Test IDs | Status |
|---|---|---|---|
| 6.1 | Signup + onboarding 3 steps | `AUTH-E2E-001`, `AUTH-INT-001`, `AUTH-INT-030` | PARTIAL |
| 6.2 | Patients chart (allergies, docs, images, history) | `PII-INT-002..009`, `FILE-INT-001`, `TEN-RLS-007` | PARTIAL |
| 6.3 | Odontogram FDI | `PII-INT-010`, `PII-DB-001` | GAP |
| 6.4 | Treatment plan | `PII-INT-011` | GAP |
| 6.5 | Calendar day/week/month, overlap, DnD | `CAL-E2E-001`, `CAL-INT-001..005`, `CAL-DB-001` | PARTIAL |
| 6.6 | Waitlist | `CAL-UNIT-001`, `CAL-INT-003` | PARTIAL |
| 6.7 | Finance (invoice/payment/plans/expenses/Excel) | `FIN-E2E-001`, `FIN-INT-*`, `FIN-API-001`, `FIN-API-002`, `FIN-UNIT-001` | PARTIAL | serial/void/append-only/peer/API/legal-settings COVERED; installments GAP |
| 6.8 | Dashboard KPI | `FIN-INT-020`, `RBAC-INT-010` | COVERED |
| 6.9 | Email system | `CRM-UNIT-001`, `CRM-INT-001`, `CRM-API-001` | PARTIAL |
| 6.10 | CRM light | `CRM-UNIT-002`, `CRM-INT-002` | PARTIAL |
| 6.11 | Consent draw-sign | `PII-INT-012`, `FILE-INT-010` | GAP |
| 6.12 | Inventory basic | `PLAN-INT-021`, `RBAC-INT-021` | PARTIAL |
| 6.13 | Branding | `PLAN-INT-022`, `FILE-INT-011` | GAP |
| 6.14 | CSV import | `IMP-UNIT-001`, `IMP-INT-001` | PARTIAL |
| 6.15 | Audit log UI | `RBAC-RLS-005` (owner SELECT); patients SA matrix starts at `RBAC-INT-001` (P3.1) | COVERED |
| 6.16 | In-app notifications | `CRM-INT-004` | GAP |

Inventory tests use IDs `PLAN-INT-021` / `RBAC-INT-021` in the strategy catalog (inventory is Pro feature under PLAN/RBAC areas).

---

## 3. Security / GDPR / ops (§8) → tests

| Req | Requirement | Test IDs | Status |
|---|---|---|---|
| 8.1 | RLS on all clinic tables | `TEN-RLS-001..030` | PARTIAL |
| 8.1 | Private storage + signed URLs | `FILE-RLS-001`, `FILE-SEC-001` | PARTIAL |
| 8.1 | Owner 2FA | `AUTH-E2E-003`, `AUTH-RLS-001` | PARTIAL |
| 8.1 | Lockout + owner alert | `AUTH-DB-001` | PARTIAL |
| 8.1 | Force logout | `AUTH-INT-020` | COVERED | Per-user via `revoke_user_sessions` (D-07 scope; D-22/D-23 fixed) |
| 8.1 | Secrets server-only | `PLAT-SEC-002`, `FILE-SEC-002` | GAP |
| 8.1 | Tenant isolation = release blocker | `TEN-*` suite | PARTIAL |
| 8.1 | Impersonation audited | `PLAT-INT-001` | COVERED |
| 8.2 | Patient export | `PII-API-001` | COVERED |
| 8.2 | Erasure owner approve → hard delete | `PII-RLS-001`, `PII-INT-001` | COVERED |
| 8.2 | PostHog no patient names | `PII-SEC-001` | GAP |
| 8.2 | Cookie banner | `MKT-E2E-004`, `PII-UNIT-002` | PARTIAL |
| 8.3 | Clinic ZIP backup | `PII-API-002` | COVERED |
| 8.3 | Close: export → grace → delete | `LIFE-INT-002`, `LIFE-SEC-002`, `LIFE-RLS-001` | COVERED |
| 8.4 | Sentry / PostHog | `MKT-UNIT-002`, `PLAT-API-002` | PARTIAL | sentry-test prod deny COVERED (P3.3); PostHog/scrub still GAP |
| 8.5 | Incident ≤72h | — | N/A | Process |

---

## 4. Packages / entitlements (§4) → tests

| Item | Test IDs | Status |
|---|---|---|
| Price display Starter/Pro/Premium/Enterprise | `MKT-UNIT-001` | COVERED |
| Limits matrix D8 | `PLAN-UNIT-001`, `PLAN-DB-001/002` | PARTIAL |
| Feature matrix §4.3 | `MKT-UNIT-001`, `PLAN-UNIT-001`, `PLAN-INT-011`, `PLAN-SEC-001` | COVERED |
| Free trial = Pro minus SMS/AI/portal | `PLAN-UNIT-002` | COVERED |
| Hard block + upsell (not soft) | `PLAN-INT-001`, `PLAN-DB-001` | PARTIAL |

---

## 5. MVP acceptance (§12.1) → tests

| Acceptance criterion | Test IDs | Status |
|---|---|---|
| Signup → clinic → onboarding step 1 | `AUTH-E2E-001` | COVERED |
| Signup without card; trial_ends_at=2026-12-31 | `AUTH-E2E-001`, `AUTH-INT-001` | PARTIAL |
| Owner invites doctor + reception; correct role | `AUTH-E2E-002` | GAP |
| Shared reception PIN + audit operator | `AUTH-INT-011` | PARTIAL |
| Plan limits block 6th doctor / 11th user / 3rd location on Pro | `PLAN-DB-001`, `PLAN-DB-002` | PARTIAL |
| Patient chart: allergies, docs, RTG WebP, FDI, treatment plan | `PII-INT-002..011` | GAP |
| Appointment default duration; overlap blocked | `CAL-E2E-001`, `CAL-DB-001` | COVERED |
| Invoice PDF number/VAT/logo; partial/paid; installments | `FIN-E2E-001`, `FIN-INT-001..010` | PARTIAL |
| Dashboard today KPI + revenue by doctor | `FIN-INT-020` | GAP |
| Locations + shared pricelist | `PLAN-INT-020` | GAP |
| Email reminder edit + send | `CRM-INT-001` | GAP |
| Branding in app shell | `PLAN-INT-022` | GAP |
| CSV import patients + services | `IMP-INT-001` | GAP |
| GDPR export; delete waits owner approve | `PII-API-001`, `PII-INT-001` | COVERED |
| Clinic ZIP backup | `PII-API-002` | COVERED |
| Trial → readonly → delete | `LIFE-RLS-001` (RLS + SA write-block), `LIFE-INT-001`, `LIFE-INT-002`, `LIFE-API-001` | COVERED |
| Clinic A cannot read Clinic B | `TEN-RLS-*`, `TEN-E2E-001` | PARTIAL |
| Storage not publicly listable; signed URL only | `FILE-RLS-001` | PARTIAL |
| Full responsive key screens | `CAL-E2E-002` | GAP |
| Marketing pricing, CTA, legal, cookie | `MKT-E2E-002`, `MKT-E2E-004` | GAP |

---

## 6. E2E release blockers (§12.2)

| Blocker | Existing | Proposed expansions | Status |
|---|---|---|---|
| Signup → create clinic → onboarding step 1 | `e2e/signup-onboarding.spec.ts` | Steps 2–3, MFA verify path | PARTIAL |
| Appointment (doctor + patient + no overlap) | `e2e/appointment.spec.ts` + `CAL-INT-004` | Waitlist on cancel; doctor peer scope COVERED | PARTIAL |
| Invoice + PDF download | `e2e/invoice-pdf.spec.ts` | Void, partial payment, installments | PARTIAL |
| Tenant isolation | `e2e/tenant-isolation.spec.ts` + Vitest | All modules + storage buckets | PARTIAL |

---

## 7. Personas / RBAC (§3) → tests

| Item | Test IDs | Status |
|---|---|---|
| Role set owner/doctor/assistant/reception/accountant | `RBAC-INT-001..005`, `006..010`, `012..017`, `021` (P3.1–P3.2) | COVERED |
| §3.2 module matrix | `RBAC-RLS-*` + `RBAC-INT-*` SA runner + doctor calendar scope | PARTIAL |
| Peer amounts asterisk for doctors | `FIN-INT-020` | COVERED |
| Invite flow + plan limit before invite | `AUTH-INT-010`, `PLAN-DB-001` | COVERED |
| Auth rules (owner MFA, 7d session, lockout, force logout) | See D11–D13 | PARTIAL |

Existing Vitest coverage for RBAC matrix (finances, clinical, front desk, owner-only, audit) is in `lib/security/rbac-and-lifecycle.test.ts` — mapped as `RBAC-RLS-001..004`, `AUTH-RLS-010`, `PII-RLS-001`, `LIFE-RLS-001` (RLS half). P3.1 Server Action matrix: `lib/security/rbac-int-matrix.test.ts`. P3.2 doctor peer calendar: `lib/security/doctor-calendar-scope.test.ts` (`CAL-INT-004` / `RBAC-INT-005`). P3.6 SA write-block: `lib/security/clinic-write-block-sa.test.ts` (extends `LIFE-RLS-001`). P3.7 invoice legal settings: `lib/security/invoice-legal-settings-sa.test.ts` (`FIN-INT-015`).

---

## 8. Marketing website (§7) → tests

| Item | Test IDs | Status |
|---|---|---|
| Locales BS/HR/SR/EN + hreflang | `MKT-E2E-001` | GAP |
| Pages (home, pricing, features, FAQ, contact, legal, blog) | `MKT-E2E-002` | GAP |
| CTA → signup | `MKT-E2E-002` | GAP |
| Lead form (honeypot + rate limit) | `MKT-UNIT-003`, `MKT-INT-001`, `MKT-SEC-001` | PARTIAL |
| Cookie consent gates PostHog | `PII-UNIT-002`, `MKT-E2E-004` | PARTIAL |
| Demo clinic open | `MKT-INT-002` | GAP |
| OG image `/api/og` | `MKT-API-001` | COVERED |

---

## 9. Existing automated tests → IDs (inventory)

| File | Assigned IDs | Covers |
|---|---|---|
| `lib/branding/parse.test.ts` | `PLAN-UNIT-010` | branding_json parse |
| `lib/onboarding/parse.test.ts` | `AUTH-UNIT-001` | onboarding/working_hours parse |
| `lib/appointments/waitlist.test.ts` | `CAL-UNIT-001` | waitlist match FIFO |
| `lib/calendar/time.test.ts` | `CAL-UNIT-002` | day/week ranges TZ |
| `lib/crm/generate.test.ts` | `CRM-UNIT-002` | birthday window |
| `lib/invoices/money.test.ts` | `FIN-UNIT-001` | net/VAT + YYYY-#### |
| `lib/reports/excel.test.ts` | `FIN-UNIT-002` | xlsx buffer |
| `lib/entitlements/entitlements.test.ts` | `PLAN-UNIT-001..003`, `AUTH-UNIT-002` | limits, free period, image assert, invite hash, PIN schema |
| `lib/marketing/plans.test.ts` | `MKT-UNIT-001` | PRD §4 prices/features |
| `lib/import/csv.test.ts` | `IMP-UNIT-001` | CSV parse/map |
| `lib/email/templates.test.ts` | `CRM-UNIT-001` | template render/escape |
| `lib/validations/lead.test.ts` | `MKT-UNIT-003` | lead Zod + honeypot |
| `lib/analytics/consent.test.ts` | `PII-UNIT-002` | cookie consent storage |
| `lib/platform/admin.test.ts` | `PLAT-UNIT-001` | isPlatformAdmin + cookie parse |
| `lib/security/tenant-isolation.test.ts` | `TEN-RLS-001..009`, `AUTH-DB-001`, `PLAN-DB-001`, `AUTH-RLS-002` | isolation + lockout + self-promote + starter invite limit |
| `lib/security/rbac-and-lifecycle.test.ts` | `RBAC-RLS-001..004`, `RBAC-RLS-005`, `AUTH-RLS-010`, `PLAN-DB-002`, `PII-RLS-001`, `LIFE-RLS-001` (RLS), `LIFE-INT-001` | RBAC, PIN, GDPR, lifecycle |
| `lib/security/clinic-write-block-sa.test.ts` | `LIFE-RLS-001` (SA half across modules) | readonly/pending_delete write-block |
| `e2e/signup-onboarding.spec.ts` | `AUTH-E2E-001` | signup MFA onboarding step 1 |
| `e2e/mfa-gate.spec.ts` | `AUTH-E2E-003` | owner MFA redirect |
| `e2e/appointment.spec.ts` | `CAL-E2E-001` | create + overlap |
| `e2e/invoice-pdf.spec.ts` | `FIN-E2E-001` | invoice + PDF |
| `e2e/tenant-isolation.spec.ts` | `TEN-E2E-001` | UI isolation patient |
| `lib/security/cron-secret-guard.test.ts` | `LIFE-API-001` | cron secret gate (unit) |
| `lib/security/api-routes-auth-matrix.test.ts` | `PLAT-API-001/002`, `MKT-API-001`, unauth half of `FIN-API-*`/`PII-API-*` | all 8 API routes auth matrix (P3.3) |

---

## 10. Requirement quality findings

### 10.1 Ambiguous

| Item | Issue | Recommendation |
|---|---|---|
| D12 session TTL “7 dana” | Supabase JWT access vs refresh vs app cookie TTL not specified; force logout is **per-user** (product decision / D-07 resolved) | Spec exact Auth settings (JWT expiry, refresh); force-logout scope settled per-user |
| D13 lock duration | PRD says “npr. 15 min”; implementation uses 15 min — document as normative | Lock PRD to 15 minutes |
| D13 owner notification | “email/in-app” — which is required for MVP? | Decide: email required, in-app optional (or both) |
| §3.2 “Ograničeno” dashboard | Not quantified for doctor/reception | Define KPI subsets (implemented in `lib/dashboard/rbac.ts` — promote to PRD) |
| §3.2 patients “Read/assist” vs “Osnovno” | Assistant write vs reception write not crisply different in code (both write patients) | Align PRD wording with `canWritePatients` or tighten code |
| D17 peer amounts default | Default true/false unspecified in PRD | Document default in settings_json |
| D15 “default duration from service” | No acceptance for missing service_id | Require service or allow free-form duration |
| Performance §12.4 | “<2s calendar”, “<1s search” — environment undefined | Define N doctors, seed size, cold vs warm |

### 10.2 Contradictory / tension

| Item | Tension | Resolution for tests |
|---|---|---|
| D8 “hard block” vs D22 image limit | Users/doctors/locations enforced in DB triggers; images only in app helper | Treat image DB bypass as Critical GAP (`FILE-DB-001`) |
| D42 entitlements vs feature tables | Feature rows insertable without plan entitlement at DB | Assert server `assertFeature` + add DB gates where Critical |
| Free 2026 vs Pro matrix | SMS metered on Pro in matrix but disabled in free period | `PLAN-UNIT-002` is source of truth until 2027 |
| D12 force logout scope | Product: per-user `forceLogoutUserAction` + `revoke_user_sessions`; PRD aligned (D-07 RESOLVED docs) | — |
| PRD §12.1 checkboxes all marked done | Several items lack automated tests | Traceability Status overrides checkbox optimism |

### 10.3 Missing (implied but not written)

| Gap | Why it matters |
|---|---|
| Explicit list of tables that must have RLS | Needed for TEN-RLS completeness checklist |
| Append-only rules for payments / invoice_lines | Implemented; not in Decision Log as D# |
| Demo clinic (`is_demo`) exempt from lifecycle | In DB/Tech; should be Decision or §8.3 note |
| Cron auth for `/api/cron/clinic-lifecycle` | Ops secret — security requirement missing from PRD §8; COVERED by `LIFE-API-001` + P3.3 matrix thin assert |
| Service-role never in client bundle | Implied by D41; needs explicit SEC test |
| Treatment plan item closed from visit | PRD §12.1 notes follow-up; still open |

### 10.4 Untestable as written / N/A for automation

| Item | Why |
|---|---|
| D1, D39, D49, D50 | Process / persona / legal stance |
| D34 EU residency | Infrastructure config; checklist in Production-Ops |
| D40 “full responsive” | Needs visual/manual matrix; automate smoke only |
| Uptime ≥99.5% | Ops SLO, not unit/E2E |
| Support first response <1 day | Process KPI |
| Social proof / reviews after ~10 days | Manual content workflow |
| Formal pen-test before 2027 | External engagement |

### 10.5 Out of MVP (track as N/A until Faza 4)

D26, D27, D31, D32, D48, patient portal, online booking, mini site, Stripe charge paths, metered billing UI.

---

## 11. Coverage summary (counts)

| Status | Decision Log | §12.1 acceptance | Notes |
|---|---|---|---|
| COVERED | ~4 | ~3 | Core blockers partially automated |
| PARTIAL | ~28 | ~12 | Primary work for P1–P4 |
| GAP | ~12 | ~7 | Need new tests |
| N/A | ~7 | 0 | Scope / process |

Exact Critical GAP list for implementation: see [Test-Strategy.md](./Test-Strategy.md) § Critical catalog and [Implementation-Plan.md](./Implementation-Plan.md).

---

*Traceability matrix — DentOrd QA — 2026-07-23.*
