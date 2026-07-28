# DentOrd — Requirements Traceability Matrix

> Maps every PRD requirement, Decision Log item (D1–D51), and §12 acceptance criterion to existing or proposed tests.
> Conventions: [README.md](./README.md). Status: `COVERED` | `PARTIAL` | `GAP` | `N/A`.

---

## 1. Decision Log (D1–D51)

| ID | Topic | Requirement (summary) | Test IDs | Status | Notes |
|---|---|---|---|---|---|
| D1 | Product | Greenfield DentOrd; Avicena reference only | — | N/A | Process / scope rule |
| D2 | MVP paket | Professional (25€/mj) + branding | `PLAN-UNIT-001`, `MKT-UNIT-001` | COVERED | Marketing prices + entitlements unit; Stripe charge N/A until Faza 4 |
| D3 | Van MVP free | No AI / SMS / WhatsApp / patient portal | `PLAN-UNIT-002`, `PLAN-INT-011` | COVERED | Free-period override unit + Pro SA feature INT; optional free-period INT `PLAN-INT-010` never catalogued |
| D4 | Free trial | Self-signup; trial_ends_at ≤ 2026-12-31 | `AUTH-E2E-001`, `AUTH-INT-001` | COVERED | Signup E2E + trial/defaults INT COVERED |
| D5 | Billing start | Stripe from 2027-01-01 | `PLAN-UNIT-002` | COVERED | Free-period / 2027 date constant unit; Stripe charge N/A until Faza 4 |
| D6 | After free | 7d read-only → export → delete | `LIFE-RLS-001`, `LIFE-INT-001`, `LIFE-INT-002`, `LIFE-API-001` | COVERED | Writable + closure + grace→pending_delete + cron gate + SA write-block across modules COVERED |
| D7 | Tenant model | 1 user = 1 clinic; owner sees all locations | `TEN-RLS-001..002`, `TEN-RLS-007..015`, `TEN-E2E-001`, `TEN-SEC-002` | COVERED | All clinic-scoped tables + forged-`clinic_id` + UI IDOR (P1.1); IDs 003–006 never assigned |
| D8 | Pro limits | ≤5 doctors, ≤10 users, ≤2 locations; hard block | `PLAN-DB-001`, `PLAN-DB-002`, `PLAN-DB-003` | COVERED | Invite + location + 6th-doctor seat triggers COVERED |
| D9 | Staff invites | Magic link → set password → role | `AUTH-E2E-002`, `AUTH-INT-010`, `AUTH-SEC-001` | COVERED | Token reuse + SA seat gate + accept E2E (doctor/reception role) |
| D10 | Shared desk PIN | Operators + PIN switch + audit | `AUTH-INT-011`, `AUTH-SEC-002`, `AUTH-UNIT-002` | COVERED | Cross-clinic PIN + schema + create/switch audit operator_id COVERED |
| D11 | 2FA | Owner MFA required; others not | `AUTH-E2E-003`, `AUTH-RLS-001`, `AUTH-E2E-001` | COVERED | MFA gate E2E + aal2 RLS write denial (P1.3) + signup path |
| D12 | Session | TTL 7 days; owner force logout **per user** | `AUTH-INT-020`, `AUTH-INT-021` | COVERED | Force logout/deactivate COVERED; TTL = `config.toml` `jwt_expiry=604800` + `timebox=168h` (`session-ttl-config.test.ts`) + Production-Ops hosted mirror |
| D13 | Lockout | 5 fails → 15 min lock + owner audit notify | `AUTH-DB-001`, `AUTH-INT-002`, `AUTH-SEC-003` | COVERED | Audit = MVP notify; lockout RPC unknown≡unlocked (no existence leak); email/bell deferred §6.16 |
| D14 | Calendar | Doctor-bound; hard block overlap | `CAL-DB-001`, `CAL-E2E-001` | COVERED | EXCLUDE + E2E overlap |
| D15 | Duration | Default from service + manual | `CAL-INT-001` | COVERED | Service 30m → ends_at = start+30m INT |
| D16 | Pricelist | Shared vs per-location toggle | `PLAN-INT-020`, `CAL-INT-002` | COVERED | `updateSharedPricelistAction` clears `services.location_id` on toggle on (`shared-pricelist.test.ts`); `CAL-INT-002` not in catalog |
| D17 | Peer amounts | Clinic setting doctors_see_peer_amounts | `FIN-INT-020`, `FIN-DB-001` | COVERED | RPC `dashboard_payment_stats`; default false |
| D18 | Odontogram | FDI; tied to visits/treatments | `PII-INT-010` | COVERED | SA + DB `is_valid_fdi` CHECK (tooth 99 rejected); no separate `PII-UNIT-001` catalog row |
| D19 | Treatment plan | planned/in_progress/done/cancelled | `PII-INT-011` | COVERED | Enum SA+DB; visit→item closure still D-11 |
| D20 | Consent sign | Draw signature on device | `PII-INT-012` | COVERED | signConsent PDF+PNG under `consents/`; storage asserts live here (`FILE-INT-010` was ID-drift) |
| D21 | Storage | Private + signed URLs; path clinic/patient | `FILE-RLS-002`, `FILE-SEC-001`, `FILE-SEC-003`, `FILE-INT-001`, `FILE-INT-011` | COVERED | Cross-clinic + anon + PDF IDOR; non-image reject; branding logo ACL |
| D22 | Image limits | Starter 10 / Pro 20 / … | `PLAN-UNIT-003`, `FILE-DB-001` | COVERED | Helper unit + DB trigger `plan_limit_images` (P1.11); SA path covered by same suite |
| D23 | Email templates | Default BS/EN; clinic edits | `CRM-UNIT-001`, `CRM-INT-001` | COVERED | Render unit + owner edit + reminder send → outbound |
| D24 | CRM light | Birthday/recall/control; reception sends | `CRM-UNIT-002`, `CRM-INT-002` | COVERED | Birthday window unit + generate open-only + human send SA |
| D25 | Waitlist | Auto-propose next on cancel | `CAL-UNIT-001`, `CAL-INT-003` | COVERED | Match unit + cancel→suggest SA INT |
| D26 | Online booking | Enterprise only | `PLAN-INT-010` | N/A | Out of MVP; assert feature off |
| D27 | Lab/technician | Enterprise only | `PLAN-INT-010` | N/A | Out of MVP |
| D28 | Fiscal cash | Not in app | — | N/A | Negative scope |
| D29 | Finance MVP | Invoices, VAT, serial, payments, debts, installments, expenses, Excel | `FIN-E2E-001`, `FIN-INT-001..015`, `FIN-API-001`, `FIN-API-002` | COVERED | Invoice+PDF E2E + serial/void/partial/append-only + installments SA + PDF/Excel API + legal settings COVERED |
| D30 | Import | CSV patients + services | `IMP-UNIT-001`, `IMP-INT-001`, `IMP-INT-002` | COVERED | Parse/map + dry-run/commit + >1MB/>500 rows reject |
| D31 | AI later | Clinic-only; draft; opt-in | — | N/A | Faza 4 |
| D32 | Metered | SMS/WA/AI/storage +15% | — | N/A | Faza 4 |
| D33 | Analytics | PostHog without patient names | `PII-SEC-001`, `PII-UNIT-002` | COVERED | Cookie consent unit + PostHog sanitize/call-site audit COVERED |
| D34 | Data residency | EU-only Supabase | `LIFE-SEC-001` | N/A | Ops checklist; not automated app test |
| D35 | GDPR delete | Hard delete with owner approval | `PII-RLS-001`, `PII-INT-001` | COVERED | Request/approve RLS + subtree hard-delete + storage cleanup INT |
| D36 | Access log | No (change audit only) | `PII-SEC-002` | GAP | Negative: no access-log table/feature |
| D37 | Languages | BS default + HR/SR fallback + EN | `MKT-E2E-001` | COVERED | Locale + hreflang smoke E2E |
| D38 | Marketing site | Full SEO/blog/pricing/signup | `MKT-E2E-002`, `MKT-UNIT-001` | COVERED | Pages + CTA E2E; plans unit |
| D39 | Deploy model | Module → prod when ready | — | N/A | Process |
| D40 | Responsive | Full responsive required | `MKT-E2E-003`, `CAL-E2E-002` | GAP | Manual UAT today |
| D41 | Super-admin | Impersonation + audit; entitlements | `PLAT-UNIT-001`, `PLAT-INT-001`, `PLAT-SEC-001`, `PLAT-SEC-002` | COVERED | isPlatformAdmin unit + impersonation audit + sticky cookie clear COVERED |
| D42 | Entitlements | plans → features[] not UI-only | `PLAN-UNIT-001`, `PLAN-INT-011`, `PLAN-SEC-001` | COVERED | Features from DB + free override; Pro SA assertFeature INT COVERED (DB residual = D-03 waived) |
| D43 | Onboarding | In-app 3 steps | `AUTH-E2E-001` | COVERED | Steps 1–3 E2E (service + skip invite → dashboard) |
| D44 | Support | support@ Resend | `CRM-INT-003` | GAP | Ops / smoke |
| D45 | Clinic close | Export → 7d grace → hard delete | `LIFE-INT-001`, `LIFE-INT-002`, `PII-API-002`, `LIFE-SEC-002`, `LIFE-RLS-001`, `RBAC-INT-024` | COVERED | Closure RPC + SA doctor deny + grace→pending_delete + demo skip + write-block COVERED |
| D46 | Phone default | +387; owner changeable | `AUTH-INT-001`, `AUTH-E2E-001` | COVERED | Onboarding E2E + signup RPC defaults INT assert `+387` |
| D47 | TZ default | Europe/Sarajevo | `CAL-UNIT-002`, `AUTH-E2E-001`, `AUTH-INT-001` | COVERED | Calendar ranges unit + onboarding E2E + signup RPC defaults INT |
| D48 | Annual sub | 2 months free (2027+) | — | N/A | Faza 4 |
| D49 | Buyer | Clinic owner | — | N/A | Persona |
| D50 | Security stance | Tool for records; doctor decides | — | N/A | Disclaimer / legal |
| D51 | Cross-clinic | v1 = 1 user 1 clinic | `TEN-SEC-001` | GAP | Negative: no membership switcher |

---

## 2. PRD feature specs (§6) → tests

| Req | Feature | Test IDs | Status |
|---|---|---|---|
| 6.1 | Signup + onboarding 3 steps | `AUTH-E2E-001`, `AUTH-INT-001` | COVERED | Steps 1–3 E2E + trial/defaults INT COVERED |
| 6.2 | Patients chart (allergies, docs, images, history) | `PII-INT-010`, `PII-INT-011`, `PII-INT-012`, `FILE-INT-001`, `TEN-RLS-007` | PARTIAL | FDI/plan/consent + non-image upload reject COVERED; allergies/docs/images INT IDs 002–009 never catalogued |
| 6.3 | Odontogram FDI | `PII-INT-010` | COVERED | FDI reject via SA+CHECK |
| 6.4 | Treatment plan | `PII-INT-011` | COVERED | Status enum COVERED; visit→item closure D-11 open (product residual) |
| 6.5 | Calendar day/week/month, overlap, DnD | `CAL-E2E-001`, `CAL-INT-001`, `CAL-INT-003`, `CAL-INT-004`, `CAL-INT-005`, `CAL-DB-001` | COVERED | Overlap/waitlist/peer/default-duration + DnD/`reschedule` `calendar_advanced` gate (`CAL-INT-005` = same SA as `PLAN-INT-011`) |
| 6.6 | Waitlist | `CAL-UNIT-001`, `CAL-INT-003` | COVERED |
| 6.7 | Finance (invoice/payment/plans/expenses/Excel) | `FIN-E2E-001`, `FIN-INT-001`, `FIN-INT-003`, `FIN-INT-004`, `FIN-INT-010`, `FIN-INT-015`, `FIN-INT-020`, `FIN-API-001`, `FIN-API-002`, `FIN-UNIT-001` | COVERED | serial/void/append-only/peer/API/legal-settings/installments COVERED |
| 6.8 | Dashboard KPI | `FIN-INT-020`, `RBAC-INT-010` | COVERED |
| 6.9 | Email system | `CRM-UNIT-001`, `CRM-INT-001` | COVERED | Template edit+reminder send COVERED; no separate CRM-API route catalogued |
| 6.10 | CRM light | `CRM-UNIT-002`, `CRM-INT-002` | COVERED | Generate open-only; send via SA |
| 6.11 | Consent draw-sign | `PII-INT-012` | COVERED | PDF+PNG under consents/ |
| 6.12 | Inventory basic | `PLAN-INT-021`, `RBAC-INT-021` | COVERED | low-stock badge/list + SA RBAC |
| 6.13 | Branding | `PLAN-INT-022`, `FILE-INT-011` | COVERED | colors→branding_json + logo upload ACL (SA owner + storage `is_clinic_owner`) |
| 6.14 | CSV import | `IMP-UNIT-001`, `IMP-INT-001`, `IMP-INT-002` | COVERED | dry-run/commit + size/row caps |
| 6.15 | Audit log UI | `RBAC-RLS-005` (owner SELECT); patients SA matrix starts at `RBAC-INT-001` (P3.1) | COVERED |
| 6.16 | In-app notifications | `CRM-INT-004` | GAP | Not in Test-Strategy catalog; deferred with §6.16 product |

Inventory tests use IDs `PLAN-INT-021` / `RBAC-INT-021` in the strategy catalog (inventory is Pro feature under PLAN/RBAC areas).

---

## 3. Security / GDPR / ops (§8) → tests

| Req | Requirement | Test IDs | Status |
|---|---|---|---|
| 8.1 | RLS on all clinic tables | `TEN-RLS-001..002`, `TEN-RLS-007..015`, `TEN-SEC-002` | COVERED | Expanded matrix P1.1; IDs 003–006/016–030 never assigned |
| 8.1 | Private storage + signed URLs | `FILE-RLS-002`, `FILE-SEC-001`, `FILE-SEC-003` | COVERED | P1.2 buckets + invoice PDF IDOR |
| 8.1 | Owner 2FA | `AUTH-E2E-003`, `AUTH-RLS-001` | COVERED | Gate E2E + aal2 RLS |
| 8.1 | Lockout + owner alert | `AUTH-DB-001`, `AUTH-INT-002` | COVERED |
| 8.1 | Force logout | `AUTH-INT-020` | COVERED | Per-user via `revoke_user_sessions` (D-07 scope; D-22/D-23 fixed) |
| 8.1 | Secrets server-only | `PLAT-SEC-002`, `PLAT-SEC-003` | COVERED | Service-role client bundle + sticky impersonation cookie clear COVERED |
| 8.1 | Tenant isolation = release blocker | `TEN-*` suite | COVERED | Critical TEN-RLS/SEC/E2E COVERED |
| 8.1 | Impersonation audited | `PLAT-INT-001` | COVERED |
| 8.2 | Patient export | `PII-API-001` | COVERED |
| 8.2 | Erasure owner approve → hard delete | `PII-RLS-001`, `PII-INT-001` | COVERED |
| 8.2 | PostHog no patient names | `PII-SEC-001` | COVERED |
| 8.2 | Cookie banner | `MKT-E2E-004`, `PII-UNIT-002` | COVERED |
| 8.3 | Clinic ZIP backup | `PII-API-002` | COVERED |
| 8.3 | Close: export → grace → delete | `LIFE-INT-002`, `LIFE-SEC-002`, `LIFE-RLS-001` | COVERED |
| 8.4 | Sentry / PostHog | `PLAT-API-002`, `MKT-E2E-004` | PARTIAL | sentry-test prod deny COVERED (P3.3); cookie→PostHog gate COVERED; scrub/DSN ops still GAP |
| 8.5 | Incident ≤72h | — | N/A | Process |

---

## 4. Packages / entitlements (§4) → tests

| Item | Test IDs | Status |
|---|---|---|
| Price display Starter/Pro/Premium/Enterprise | `MKT-UNIT-001` | COVERED |
| Limits matrix D8 | `PLAN-UNIT-001`, `PLAN-DB-001`, `PLAN-DB-002`, `PLAN-DB-003` | COVERED | users/locations/doctors DB triggers COVERED |
| Feature matrix §4.3 | `MKT-UNIT-001`, `PLAN-UNIT-001`, `PLAN-INT-011`, `PLAN-SEC-001` | COVERED |
| Free trial = Pro minus SMS/AI/portal | `PLAN-UNIT-002` | COVERED |
| Hard block + upsell (not soft) | `PLAN-DB-001`, `PLAN-DB-002`, `PLAN-DB-003`, `FILE-DB-001`, `PLAN-SEC-001` | COVERED | DB triggers (users/locations/doctors/images) + feature SA gate |

---

## 5. MVP acceptance (§12.1) → tests

| Acceptance criterion | Test IDs | Status |
|---|---|---|
| Signup → clinic → onboarding steps 1–3 | `AUTH-E2E-001` | COVERED |
| Signup without card; trial_ends_at=2026-12-31 | `AUTH-E2E-001`, `AUTH-INT-001` | COVERED | E2E signup + trial date INT COVERED |
| Owner invites doctor + reception; correct role | `AUTH-E2E-002` | COVERED |
| Shared reception PIN + audit operator | `AUTH-INT-011` | COVERED | Cross-clinic PIN SEC + create/switch audit operator_id COVERED |
| Plan limits block 6th doctor / 11th user / 3rd location on Pro | `PLAN-DB-001`, `PLAN-DB-002`, `PLAN-DB-003` | COVERED | users + locations + 6th doctor COVERED |
| Patient chart: allergies, docs, RTG WebP, FDI, treatment plan | `PII-INT-010`, `PII-INT-011`, `PII-INT-012`, `TEN-RLS-007` | PARTIAL | FDI + plan status + consent COVERED; allergies/docs/images INT never catalogued |
| Appointment default duration; overlap blocked; waitlist propose on cancel | `CAL-E2E-001`, `CAL-DB-001`, `CAL-INT-003`, `CAL-INT-001` | COVERED | Overlap + waitlist + default-duration INT COVERED |
| Invoice PDF number/VAT/logo; partial/paid; installments | `FIN-E2E-001`, `FIN-INT-001`, `FIN-INT-003`, `FIN-INT-004`, `FIN-INT-010` | COVERED | PDF E2E + partial/paid + void + installments feature gate COVERED |
| Dashboard today KPI + revenue by doctor | `FIN-INT-020`, `RBAC-INT-010` | COVERED |
| Locations + shared pricelist | `PLAN-INT-020` | COVERED |
| Email reminder edit + send | `CRM-INT-001` | COVERED |
| Branding in app shell | `PLAN-INT-022` | COVERED |
| CSV import patients + services | `IMP-INT-001` | COVERED |
| GDPR export; delete waits owner approve | `PII-API-001`, `PII-INT-001` | COVERED |
| Clinic ZIP backup | `PII-API-002` | COVERED |
| Trial → readonly → delete | `LIFE-RLS-001` (RLS + SA write-block), `LIFE-INT-001`, `LIFE-INT-002`, `LIFE-API-001` | COVERED |
| Clinic A cannot read Clinic B | `TEN-RLS-001..002`, `TEN-RLS-007..015`, `TEN-E2E-001` | COVERED |
| Storage not publicly listable; signed URL only | `FILE-RLS-002`, `FILE-SEC-001`, `FILE-SEC-003` | COVERED |
| Full responsive key screens | `CAL-E2E-002`, `MKT-E2E-003` | GAP | Manual UAT (see [UAT-Partner.md](../UAT-Partner.md)) |
| Marketing pricing, CTA, legal, cookie | `MKT-E2E-002`, `MKT-E2E-004` | COVERED |

---

## 6. E2E release blockers (§12.2)

| Blocker | Existing | Proposed expansions | Status |
|---|---|---|---|
| Signup → create clinic → onboarding steps 1–3 | `e2e/signup-onboarding.spec.ts` | MFA verify path (separate `AUTH-E2E-003`); invite accept → `AUTH-E2E-002` | COVERED |
| Appointment (doctor + patient + no overlap) | `e2e/appointment.spec.ts` + `CAL-INT-004` + `CAL-INT-003` | Overlap + peer scope + waitlist propose on cancel | COVERED |
| Invoice + PDF download | `e2e/invoice-pdf.spec.ts` + `FIN-INT-003/004` INT | Installments (void/partial satisfied via INT P2.2/P4.4) | PARTIAL |
| Tenant isolation | `e2e/tenant-isolation.spec.ts` + Vitest TEN-RLS suite | All modules + storage buckets (P1.1/P1.2) | COVERED |

---

## 7. Personas / RBAC (§3) → tests

| Item | Test IDs | Status |
|---|---|---|
| Role set owner/doctor/assistant/reception/accountant | `RBAC-INT-001..005`, `006..011`, `012..027` (P3.1–P3.2 + P3 exit) | COVERED |
| §3.2 module matrix | `RBAC-RLS-*` + `RBAC-INT-*` SA + doctor calendar + Critical SA exit file | COVERED |
| Peer amounts asterisk for doctors | `FIN-INT-020` | COVERED |
| Invite flow + plan limit before invite | `AUTH-INT-010`, `PLAN-DB-001`, `RBAC-INT-022` | COVERED |
| Auth rules (owner MFA, 7d session, lockout, force logout) | See D11–D13 | COVERED | MFA + lockout + force logout + session TTL config (`AUTH-INT-021`) + lockout enumeration (`AUTH-SEC-003`) COVERED |

Existing Vitest coverage for RBAC matrix (finances, clinical, front desk, owner-only, audit) is in `lib/security/rbac-and-lifecycle.test.ts` — mapped as `RBAC-RLS-001..004`, `AUTH-RLS-010`, `PII-RLS-001`, `LIFE-RLS-001` (RLS half). P3.1 Server Action matrix: `lib/security/rbac-int-matrix.test.ts`. P3.2 doctor peer calendar: `lib/security/doctor-calendar-scope.test.ts` (`CAL-INT-004` / `RBAC-INT-005`). P3.6 SA write-block: `lib/security/clinic-write-block-sa.test.ts` (extends `LIFE-RLS-001`). P3.7 invoice legal settings: `lib/security/invoice-legal-settings-sa.test.ts` (`FIN-INT-015`). P3 exit Critical SA / module polarity: `lib/security/p3-exit-critical-sa-rbac.test.ts` (`RBAC-INT-011`, `018–020`, `022–027`). Audit UI remains RLS-only (`RBAC-RLS-005`).

---

## 8. Marketing website (§7) → tests

| Item | Test IDs | Status |
|---|---|---|
| Locales BS/HR/SR/EN + hreflang | `MKT-E2E-001` | COVERED |
| Pages (home, pricing, features, FAQ, contact, legal, blog) | `MKT-E2E-002` | COVERED |
| CTA → signup | `MKT-E2E-002` | COVERED |
| Lead form (honeypot + rate limit) | `MKT-UNIT-003`, `MKT-INT-001`, `MKT-SEC-001`, `MKT-SEC-002` | COVERED |
| Cookie consent gates PostHog | `PII-UNIT-002`, `MKT-E2E-004` | COVERED |
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
| `lib/security/tenant-isolation.test.ts` | `TEN-RLS-001..002`, `007..009`, `AUTH-DB-001`, `PLAN-DB-001`, `AUTH-RLS-002` | isolation + lockout + self-promote + starter invite limit |
| `lib/security/tenant-isolation-expanded.test.ts` | `TEN-RLS-010..015`, `TEN-SEC-002` | remaining clinic tables + forged clinic_id |
| `lib/security/storage-isolation.test.ts` | `FILE-RLS-002`, `FILE-SEC-001`, `FILE-SEC-003` | storage cross-clinic + anon + invoice PDF IDOR |
| `lib/security/mfa-aal2-rls.test.ts` | `AUTH-RLS-001` | owner aal1 write denial |
| `lib/security/invite-token.test.ts` | `AUTH-SEC-001` | invite token reuse/expiry |
| `lib/security/leads-and-subscriptions-rls.test.ts` | `MKT-SEC-001` | leads RLS deny (+ `PLAN-RLS-001` ID-drift note) |
| `lib/security/image-limit-db.test.ts` | `FILE-DB-001` | patient image plan_limit trigger |
| `lib/security/feature-entitlement-bypass.test.ts` | `PLAN-SEC-001` | feature insert without entitlement |
| `lib/security/jwt-hook-fallback.test.ts` | `TEN-SEC-004`, `TEN-SEC-003` | JWT hook-off fallback + stale-role profiles-first hardening |
| `lib/security/no-service-role-in-client.test.ts` | `PLAT-SEC-003` | service role not in client |
| `lib/security/allocate-invoice-number.test.ts` | `FIN-SEC-001`, `FIN-DB-001`, `FIN-INT-001` | allocate clinic gate + serial uniqueness |
| `lib/security/peer-amounts.test.ts` | `FIN-INT-020` | doctors_see_peer_amounts RPC |
| `lib/security/gdpr-erasure-subtree.test.ts` | `PII-INT-001` | erasure subtree + storage |
| `lib/security/lifecycle-transitions.test.ts` | `LIFE-INT-002`, `LIFE-SEC-002` | grace→pending_delete + demo skip |
| `lib/security/impersonation-audit.test.ts` | `PLAT-INT-001` | impersonation audit |
| `lib/security/plan-limit-doctors.test.ts` | `PLAN-DB-003` | Pro 6th doctor invite → plan_limit_doctors |
| `lib/security/analytics-pii.test.ts` | `PII-SEC-001` | PostHog sanitize + trackEvent call-site audit |
| `lib/security/signup-trial-defaults.test.ts` | `AUTH-INT-001` | trial_ends_at + TZ/phone RPC defaults |
| `lib/security/appointment-duration.test.ts` | `CAL-INT-001` | service 30m → ends_at = start+30m |
| `lib/security/installments-feature.test.ts` | `FIN-INT-010` | Starter installments blocked; Pro planCreated |
| `lib/security/impersonation-sticky.test.ts` | `PLAT-SEC-002` | stop/mismatch clears impersonation cookie |
| `lib/security/operator-pin-audit.test.ts` | `AUTH-INT-011` | create+switch audit operator_id |
| `lib/security/rbac-and-lifecycle.test.ts` | `RBAC-RLS-001..005`, `AUTH-SEC-002`, `PLAN-DB-002`, `PII-RLS-001`, `LIFE-RLS-001` (RLS), `LIFE-INT-001` | RBAC, PIN cross-clinic, GDPR, lifecycle |
| `lib/security/clinic-write-block-sa.test.ts` | `LIFE-RLS-001` (SA half across modules) | readonly/pending_delete write-block |
| `lib/security/rbac-int-matrix.test.ts` | `RBAC-INT-001..004`, `006..010`, `012..017`, `021` | SA role allow/deny matrix |
| `lib/security/doctor-calendar-scope.test.ts` | `CAL-INT-004`, `RBAC-INT-005` | doctor peer calendar |
| `lib/security/waitlist-on-cancel.test.ts` | `CAL-INT-003` | cancel → waitlist propose |
| `lib/security/patient-chart-clinical.test.ts` | `PII-INT-010`, `PII-INT-011`, `PII-INT-012` | FDI reject; plan item status enum; consent PDF+PNG |
| `lib/security/crm-send-reminder.test.ts` | `CRM-INT-001`, `CRM-INT-002` | reminder template+send; CRM generate vs human send |
| `lib/security/csv-import-dry-run.test.ts` | `IMP-INT-001` | CSV preview errors block commit; clean patients+services commit + audit |
| `lib/security/csv-import-caps.test.ts` | `IMP-INT-002` | CSV >1MB / >500 rows rejected |
| `lib/security/inventory-branding-smoke.test.ts` | `PLAN-INT-021`, `PLAN-INT-022` | low-stock badge count; branding_json colors persist |
| `lib/security/branding-upload-acl.test.ts` | `FILE-INT-011` | branding logo SA + storage ACL (doctor deny / owner allow) |
| `lib/security/non-image-upload.test.ts` | `FILE-INT-001` | non-image / spoofed MIME → rejected (no patient_images row) |
| `lib/security/session-ttl-config.test.ts` | `AUTH-INT-021` | config.toml jwt_expiry + sessions timebox = 7d |
| `lib/security/lockout-email-enumeration.test.ts` | `AUTH-SEC-003` | lockout RPC unknown ≡ unlocked; locked message generic |
| `lib/security/lead-rate-limit.test.ts` | `MKT-INT-001`, `MKT-SEC-002` | 5/hour IP cap; honeypot silent ok no INSERT |
| `lib/security/invite-force-logout-deactivate.test.ts` | `AUTH-INT-010`, `AUTH-INT-020` | invite seat + force logout + deactivate |
| `lib/security/plan-feature-assert-sa.test.ts` | `PLAN-INT-011`, `CAL-INT-005` | Pro SA assertFeature; DnD/reschedule `calendar_advanced` (same path, no duplicate) |
| `lib/security/shared-pricelist.test.ts` | `PLAN-INT-020` | Shared pricelist toggle clears `services.location_id` |
| `lib/security/invoice-legal-settings-sa.test.ts` | `FIN-INT-015` | legal settings gates |
| `lib/security/payments-append-only-void.test.ts` | `FIN-RLS-001`, `FIN-INT-003`, `FIN-INT-004` | append-only payments/lines; unpaid→partial→paid; void SA gate |
| `lib/security/p3-exit-critical-sa-rbac.test.ts` | `RBAC-INT-011`, `018..020`, `022..027` | Critical SA wrong-role + polarity |
| `lib/security/finance-api-rbac.test.ts` | `FIN-API-001`, `FIN-API-002` | PDF/Excel RBAC |
| `lib/security/privacy-api-rbac.test.ts` | `PII-API-001`, `PII-API-002` | patient JSON / clinic ZIP RBAC |
| `e2e/signup-onboarding.spec.ts` | `AUTH-E2E-001` | signup MFA onboarding steps 1–3 (skip invite) |
| `e2e/staff-invite-accept.spec.ts` | `AUTH-E2E-002` | doctor + reception accept invite → role |
| `e2e/mfa-gate.spec.ts` | `AUTH-E2E-003` | owner MFA redirect |
| `e2e/appointment.spec.ts` | `CAL-E2E-001` | create + overlap |
| `e2e/invoice-pdf.spec.ts` | `FIN-E2E-001` | invoice + PDF |
| `e2e/tenant-isolation.spec.ts` | `TEN-E2E-001` | UI isolation patient |
| `e2e/marketing-smoke.spec.ts` | `MKT-E2E-001`, `MKT-E2E-002`, `MKT-E2E-004` | locales/hreflang; pages+pricing CTA→signup; cookie banner + PostHog gate |
| `lib/security/lockout-owner-notify.test.ts` | `AUTH-INT-002` | lockout → owner JWT reads `auth.login_lockout`; doctor denied |
| `lib/security/cron-secret-guard.test.ts` | `LIFE-API-001` | cron secret gate (unit) |
| `lib/security/api-routes-auth-matrix.test.ts` | `PLAT-API-001/002`, `MKT-API-001`, unauth half of `FIN-API-*`/`PII-API-*` | all 8 API routes auth matrix (P3.3) |

---

## 10. Requirement quality findings

### 10.1 Ambiguous

| Item | Issue | Recommendation |
|---|---|---|
| D12 session TTL “7 dana” | Checked-in `supabase/config.toml`: `jwt_expiry=604800`, `[auth.sessions] timebox=168h`; Production-Ops hosted mirror; `AUTH-INT-021` COVERED | Hosted dashboard must stay mirrored (ops) |
| D13 lock duration | Was “npr. 15 min”; code uses 15 min | **Resolved (P5.7):** PRD D13 now normative **15 min** |
| D13 owner notification | Was “email/in-app” | **Resolved (P5.7):** MVP = owner Audit UI (`auth.login_lockout`); email/bell deferred §6.16 |
| §3.2 “Ograničeno” dashboard | Not quantified for doctor/reception | Define KPI subsets (implemented in `lib/dashboard/rbac.ts` — promote to PRD) |
| §3.2 patients “Read/assist” vs “Osnovno” | Assistant write vs reception write not crisply different in code (both write patients) | Align PRD wording with `canWritePatients` or tighten code |
| D17 peer amounts default | Default true/false unspecified in PRD | Document default in settings_json |
| D15 “default duration from service” | No acceptance for missing service_id | Require service or allow free-form duration |
| Performance §12.4 | “<2s calendar”, “<1s search” — environment undefined | Define N doctors, seed size, cold vs warm |

### 10.2 Contradictory / tension

| Item | Tension | Resolution for tests |
|---|---|---|
| D8 “hard block” vs D22 image limit | Users/doctors/locations enforced in DB triggers; images historically app-only | **Resolved (P1.11):** images now have `plan_limit_images` DB trigger (`FILE-DB-001` COVERED); doctor seat (`PLAN-DB-003`) still GAP |
| D42 entitlements vs feature tables | Feature rows insertable without plan entitlement at DB | Assert server `assertFeature` + document residual (D-03 waived MVP); `PLAN-SEC-001`/`PLAN-INT-011` COVERED |
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
| COVERED | 32 | 14 | P1–P6a automated suite; see §9 inventory |
| PARTIAL | 3 | 4 | Residuals mostly Medium/DnD/chart depth / process |
| GAP | 5 | 2 | Shared pricelist; responsive (manual UAT); plus Low/process Decision gaps |
| N/A | 11 | 0 | Scope / process / Faza 4 |

Catalog SoT for individual test IDs: [Test-Strategy.md](./Test-Strategy.md). P6a Critical+High residual IDs COVERED (`PLAN-DB-003`, `PII-SEC-001`, `AUTH-INT-001`, `CAL-INT-001`, `FIN-INT-010`, `PLAT-SEC-002`, `AUTH-INT-011`). Partner manual checklist: [UAT-Partner.md](../UAT-Partner.md).

---

*Traceability matrix — DentOrd QA — updated 2026-07-28 (P6a Critical+High residual).*
