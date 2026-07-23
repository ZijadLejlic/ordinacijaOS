# DentOrd — Business Rules & RBAC

> Extracted from PRD Decision Log + §3–§8, reconciled against `lib/*/rbac.ts`, DB `can_*` helpers, triggers, and server actions.
> Related: [Traceability-Matrix.md](./Traceability-Matrix.md), [Discrepancies.md](./Discrepancies.md).

---

## 1. Enforcement point legend

| Code | Meaning |
|---|---|
| **DB-C** | Postgres constraint (UNIQUE, CHECK, EXCLUDE, FK) |
| **DB-T** | Trigger |
| **DB-F** | SECURITY DEFINER function / RPC |
| **RLS** | Row Level Security policy |
| **SA** | Server Action (`lib/*/actions.ts`) |
| **API** | Route Handler (`app/api/*`) |
| **MW** | Next.js middleware |
| **UI** | Client-only / soft gate (insufficient alone) |

A rule is **hard** only if DB-C/DB-T/DB-F/RLS enforce it. SA/API alone are bypassable via PostgREST with a stolen JWT if RLS permits.

---

## 2. Business rules catalog

### 2.1 Tenancy & identity

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-T01 | Every business row scoped by `clinic_id` (except global `plans`, `plan_entitlements`, `leads`) | RLS + schema | Yes |
| BR-T02 | 1 auth user ↔ 1 clinic (v1); no cross-clinic membership | Schema + app; profiles.clinic_id | Yes (by design) |
| BR-T03 | `current_clinic_id()` from JWT `app_metadata.clinic_id` else `profiles` | DB-F | Yes |
| BR-T04 | User cannot change own `role`, `is_active`, or `clinic_id` | DB-T `profiles_guard_sensitive_columns` + RLS | Yes |
| BR-T05 | Deactivated profile (`is_active=false`) cannot act | SA checks + JWT hook skips inactive | Partial (hook) |
| BR-T06 | Demo clinic (`is_demo=true`) skipped by lifecycle hard delete | DB-F `hard_delete_clinic`, `run_clinic_lifecycle_transitions` | Yes |

### 2.2 Auth, MFA, lockout, PIN

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-A01 | Owner must use TOTP MFA before app access | MW `resolveOwnerMfaGate` + RLS `owner_mfa_ok()` | Yes (when MFA enrolled) |
| BR-A02 | Non-owners: MFA not required | MW / product | Yes |
| BR-A03 | Owners with verified MFA must have JWT `aal=aal2` for writes | RLS restrictive `owner_mfa_ok` | Yes |
| BR-A04 | 5 failed logins → lock ~15 min + audit `auth.login_lockout` | DB-F `record_failed_login` | Yes |
| BR-A05 | Login blocked while `locked_until > now()` | DB-F `check_login_lockout` + SA | Yes |
| BR-A06 | Successful login clears lockout counters | DB-F `clear_login_lockout` | Yes |
| BR-A07 | Shared reception/assistant: if active operators exist, PIN required | MW + DB-F `shared_desk_needs_pin` | Yes |
| BR-A08 | PIN 4–6 digits; bcrypt hash; `pin_hash` not API-selectable | DB-F + grants | Yes |
| BR-A09 | 5 wrong PIN → 15 min lock on profile | DB-F `verify_operator_pin` | Yes |
| BR-A10 | Operator switch writes audit with `actor_user_id` + `operator_id` | DB-F | Yes |
| BR-A11 | Operators only on reception/assistant profiles | DB-T / RPC guard | Yes |
| BR-A12 | Session refresh TTL 7 days (product) | Supabase Auth config | Ops |
| BR-A13 | Owner can force-logout a user (Auth Admin) | SA `forceLogoutUserAction` | App |
| BR-A14 | Invite token stored as sha256; raw only in email | SA + DB | Yes |
| BR-A15 | Invite accept via service_role RPCs only | Grants on `peek/accept_clinic_invite` | Yes |

### 2.3 Plans, limits, entitlements

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-P01 | Free 2026 signup → Professional entitlements; `trial_ends_at` end of 2026 | SA signup + RPC `create_clinic_for_owner` | App/DB |
| BR-P02 | Free period disables `sms_whatsapp`, `ai_copilot`, `patient_portal` | SA `applyFreePeriodOverrides` | Soft (app) |
| BR-P03 | Feature access from `plan_entitlements` (D42) | SA `assertFeature` / `getClinicEntitlements` | Soft (app) |
| BR-P04 | User seat limit: active profiles + pending invites | DB-T `enforce_invite_limits` + SA | Yes |
| BR-P05 | Doctor seat limit: active doctors + pending doctor invites | DB-T same | Yes |
| BR-P06 | Location limit: **active** locations only | DB-T `enforce_location_limits` + SA | Yes |
| BR-P07 | Images per patient by plan | SA `assertCanAddPatientImage` only | **No** (app-only) |
| BR-P08 | Exceeding limit → hard block + upsell, not soft warn | SA error codes + UI | Intent |
| BR-P09 | Starter/Pro/Premium/Enterprise limits per PRD §4.2 | `plans.limits_json` seed | Data |

### 2.4 Clinic lifecycle

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-L01 | Clinic status ∈ {active, readonly, pending_delete} | Schema enum | Yes |
| BR-L02 | Non-active clinics: no business writes | RLS `clinic_is_writable()` restrictive | Yes |
| BR-L03 | Trial/unpaid → readonly with 7-day grace | DB-F lifecycle + cron API | Yes |
| BR-L04 | After grace → pending_delete → `hard_delete_clinic` | Cron + DB-F service_role | Yes |
| BR-L05 | Owner-requested closure → readonly + grace | DB-F `request_clinic_closure` (owner+MFA) | Yes |
| BR-L06 | Cron endpoint requires `CRON_SECRET` | API | Soft if secret weak |
| BR-L07 | Hard delete removes DB + storage + auth users | DB-F | Yes |

### 2.5 Clinical

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-C01 | FDI tooth numbers must be valid | DB-F `is_valid_fdi` / CHECK | Yes |
| BR-C02 | Treatment plan statuses: planned/in_progress/done/cancelled | Enum + SA | Yes |
| BR-C03 | Treatment plan item `clinic_id` matches parent | DB-T | Yes |
| BR-C04 | Appointment statuses include pending_confirmation, confirmed, completed, cancelled, no_show | Enum | Yes |
| BR-C05 | No overlapping appointments for same doctor (excl. cancelled/no_show) | DB-C EXCLUDE | Yes |
| BR-C06 | Doctor may only mutate own calendar unless manage-all role | SA `assertDoctorScope` + RLS | Yes |
| BR-C07 | Default appointment duration from service; overridable | SA | Soft |
| BR-C08 | Waitlist: on cancel, propose next by priority/FIFO | SA + unit algorithm | Soft |
| BR-C09 | Shared pricelist toggle clears `services.location_id` when enabled | SA | Soft |
| BR-C10 | Patient deactivate soft (is_active), not hard delete | SA | Soft |
| BR-C11 | GDPR erasure = hard delete full patient subtree | DB-F `approve_gdpr_patient_erasure` | Yes |

### 2.6 Finance

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-F01 | Invoice number `YYYY-####` per clinic; Sarajevo year | DB-F `allocate_invoice_number` | Yes |
| BR-F02 | Invoice statuses unpaid/partial/paid/void | Enum + trigger on payments | Yes |
| BR-F03 | Payments append-only (no delete) | RLS / grants | Yes* |
| BR-F04 | Invoice lines insert-only snapshot | RLS | Yes* |
| BR-F05 | Void invoice instead of delete | SA | Soft + no DELETE policy |
| BR-F06 | Payment methods: cash/card/transfer/other (record only) | Enum | Yes |
| BR-F07 | Installment plans gated by `installments_calculator` | SA feature | Soft |
| BR-F08 | Expenses void, not delete | SA + RLS | Soft |
| BR-F09 | Excel export gated `expenses_reports_excel` | API + feature | Soft |
| BR-F10 | Doctors see own amounts; peers iff `doctors_see_peer_amounts` | DB-F `dashboard_payment_stats` | Yes (RPC) |
| BR-F11 | Accountant may resolve patient id/name without full chart | DB-F invoice patient directory | Yes |

\* Confirm DELETE denied for authenticated — see Discrepancies spot-checks.

### 2.7 Privacy, audit, analytics

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-G01 | Patient erasure: request → owner approve → hard delete | SA + DB-F MFA | Yes |
| BR-G02 | Patient JSON export for clinical staff with access | API RBAC | Soft |
| BR-G03 | Clinic ZIP backup owner-only | API | Soft |
| BR-G04 | Audit log SELECT owner-only | RLS | Yes |
| BR-G05 | Members can INSERT audit with self as actor | RLS | Yes |
| BR-G06 | No patient-facing access log (D36) | Product absence | N/A |
| BR-G07 | PostHog events: clinic_id, role, event — no patient names | App analytics helpers | Soft |
| BR-G08 | Analytics only after cookie consent | Client gate | Soft |

### 2.8 Storage / files

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-S01 | Path prefix `{clinic_id}/...` | App path builders + storage RLS | Yes |
| BR-S02 | Buckets private; access via signed URL short TTL | Storage policies + SA | Yes |
| BR-S03 | patient-files: docs PDF, images WebP, consents, invoice PDFs | App + storage | Soft format |
| BR-S04 | clinic-branding: owner write, member read same clinic | Storage RLS | Yes |
| BR-S05 | Image count ≤ plan limit | SA only | **No** |

### 2.9 Platform admin

| ID | Rule | Enforcement | Hard? |
|---|---|---|---|
| BR-X01 | Platform admin = `app_metadata.is_platform_admin === true` only | SA + MW; never user_metadata | Soft (JWT) |
| BR-X02 | Impersonation audited start/stop | SA + audit_events | Soft |
| BR-X03 | Service role only on server | Build/env discipline | Ops |
| BR-X04 | Platform admin without impersonation blocked from clinic app | MW | Soft |
| BR-X05 | `leads` table: no anon/authenticated policies; service_role only | RLS + REVOKE | Yes |

---

## 3. Permission matrix (PRD §3.2 vs code)

Roles: **O** owner · **D** doctor · **A** assistant · **R** reception · **C** accountant · **T** technician (Enterprise; mostly read stubs)

Legend: **Y** yes · **N** no · **L** limited · **\*** peer-amount dependent · **?** PRD vague / code differs

### 3.1 Module access (reconciled)

| Module | PRD O/D/A/R/C | Code (`lib/*/rbac.ts` + DB `can_*`) | Match? |
|---|---|---|---|
| Dashboard KPI | Y / L / N / L / financial | `canSeeDashboardKpis`: O,D,R,C; ops O,D,R; finance O,C; A=N | Yes (L implemented) |
| Patients / chart | Y / Y / Read-assist / Osnovno / N | Access+write: O,D,A,R (A and R both write) | **Tension** — PRD implies A/R weaker; code same write |
| Odontogram / treatment plan | Y / Y / Read / N / N | Read O,D,A; write O,D | Yes |
| Calendar | Y / own+filter / Y / Y / N | Access O,D,A,R; doctor scoped unless manage-all (O,A,R) | Yes |
| Invoices / payments | Y / N* / N / N / Y | O,C only (`canAccessInvoices`) | Yes (* peer via D17 on KPIs, not invoice module) |
| Expenses / Excel | Y / N / N / N / Y | O,C + feature gate | Yes |
| Email templates | Y / N / N / Read-send / N | Write O; send O,R | Yes |
| CRM / waitlist | Y / N / N / Y / N | O,R | Yes |
| Users / invite | Y / N / N / N / N | Owner SA | Yes |
| Settings / branding | Y / N / N / N / N | Owner | Yes |
| Import CSV | Y / N / N / N / C (services) | Patients O; services O,C | Yes |
| Audit log UI | Y / N / N / N / N | Owner RLS SELECT | Yes |
| Inventory basic | Y / Y / Y / Y / N | O,D,A,R write | Yes |
| Consent templates | (Pro; owner edit) | Write forms O; sign = patient writers | Yes |
| Privacy / GDPR approve | Owner | Owner manage; request O,D,A,R | Yes |
| Onboarding wizard | Owner | Owner only | Yes |
| Services CRUD | (implied owner) | Write O; read all roles | Yes |
| Locations | Owner | Owner | Yes |

### 3.2 Known PRD ↔ code mismatches

| Finding | Detail | Test impact |
|---|---|---|
| Assistant/reception patient “read vs write” | Both can write patients/allergies/docs/images | RBAC tests assert **code** truth; PRD should be updated or code tightened |
| Doctor “Ne*” on invoices | Doctors have no invoice module access; peer amounts only via dashboard RPC | `FIN-INT-020` |
| Force logout “all clinic sessions” | Implemented per-user | AUTH tests document actual behavior |
| Image limit | Not in RLS | Critical SEC test for direct insert |
| Feature entitlements | Not in DB triggers | Critical for CRM/inventory/consent if Starter plan forced |

### 3.3 DB helper ↔ TS helper parity checklist

For each pair, tests must assert identical allow-sets:

| Domain | TS | DB |
|---|---|---|
| Patients | `canAccessPatients` / `canWritePatients` | `can_access_patients` / `can_write_patients` |
| Odontogram | `canWriteOdontogram` | `can_write_odontogram` |
| Treatment plan | `canWriteTreatmentPlan` | `can_write_treatment_plan` |
| Appointments | `canWriteCalendar` + scope | `can_write_appointments` + manage-all |
| Waitlist | `canWriteWaitlist` | `can_write_waitlist` |
| Invoices | `canWriteInvoices` | `can_write_invoices` |
| Expenses | `canWriteExpenses` | `can_write_expenses` |
| Email | `canWriteEmailTemplates` / `canSendEmailReminders` | `can_write_email_templates` / `can_send_outbound_messages` |
| CRM | `canSendCrmMessages` | `can_access_crm` |
| Inventory | `canWriteInventory` | `can_write_inventory` |
| Import services | `canImportServices` | `can_import_services` |
| Consent | `canWriteConsentForms` / `canSignConsents` | matching `can_*` |
| Audit | `canViewAuditLog` | RLS owner SELECT (no separate can_*) |

---

## 4. Critical user journeys

### J1 — Owner activation (release blocker)

```text
Marketing CTA → Signup → create_clinic_for_owner
  → MFA enroll (aal2) → Onboarding step 1 (clinic/hours/TZ)
  → Step 2 services (or CSV) → Step 3 invite staff (or skip)
  → Dashboard
```

**Risks:** clinic without MFA; trial date wrong; onboarding skippable incorrectly; email confirmation edge cases.  
**Tests:** `AUTH-E2E-001`, `AUTH-E2E-003`, `AUTH-INT-001`, `AUTH-INT-030`.

### J2 — Staff invite + PIN desk

```text
Owner (MFA) → Invite doctor/reception → Magic link → Set password
  → Login as reception → PIN operators → Switch operator → Audit
```

**Risks:** plan limit bypass; token reuse; wrong role; PIN lockout; cross-clinic operator.  
**Tests:** `AUTH-E2E-002`, `AUTH-INT-010/011`, `PLAN-DB-001`, `AUTH-SEC-002`.

### J3 — Clinical day (appointment)

```text
Reception/doctor → Create patient → Create appointment (service duration)
  → Overlap blocked → Complete / cancel → Waitlist propose
```

**Risks:** double-book; doctor sees other doctor’s slots mutate; timezone wrong.  
**Tests:** `CAL-E2E-001`, `CAL-DB-001`, `CAL-INT-001/003`, `RBAC-INT-005`.

### J4 — Money path (invoice + PDF)

```text
Accountant/owner → Create invoice (allocate number) → PDF stored
  → Record partial payment → Paid → Optional payment plan → Excel export
```

**Risks:** number collision; cross-clinic allocate; DELETE payment; PDF IDOR.  
**Tests:** `FIN-E2E-001`, `FIN-INT-001..010`, `FIN-API-001`, `FIN-SEC-001`.

### J5 — GDPR erasure

```text
Staff requests erasure → Owner reviews → Approve (MFA)
  → hard delete patient subtree + storage → Audit gdpr.patient_erased
```

**Risks:** delete without approve; partial delete leftover PII; non-owner approve.  
**Tests:** `PII-RLS-001`, `PII-INT-001`, `PII-API-001`, `FILE-INT-020`.

### J6 — Clinic lifecycle / close

```text
Trial ends or owner close → readonly (exports OK, writes blocked)
  → grace 7d → pending_delete → cron hard_delete_clinic
```

**Risks:** writes in readonly; demo deleted; cron unauthenticated; incomplete delete.  
**Tests:** `LIFE-RLS-001`, `LIFE-INT-001/002`, `LIFE-API-001`, `LIFE-SEC-001`.

### J7 — Tenant isolation (always)

```text
Clinic A user attempts read/write Clinic B rows + storage paths + signed URLs
```

**Risks:** data breach; regulatory failure; release blocker.  
**Tests:** `TEN-RLS-*`, `TEN-E2E-001`, `FILE-RLS-*`, `TEN-SEC-*`.

### J8 — Platform impersonation

```text
Platform admin → start impersonation (audited) → act as owner → stop (audited)
```

**Risks:** unaudited access; privilege sticky cookie; user_metadata spoof.  
**Tests:** `PLAT-INT-001`, `PLAT-SEC-001`, `PLAT-UNIT-001`.

---

## 5. State machines (test oracles)

### Appointment status

`pending_confirmation` → `confirmed` → `completed` | `cancelled` | `no_show`  
Overlap EXCLUDE ignores `cancelled` and `no_show`.

### Invoice status

`unpaid` → `partial` → `paid`; or → `void`  
Driven by payment sum trigger; void via SA.

### Treatment plan item

`planned` → `in_progress` → `done` | `cancelled`

### Clinic status

`active` → `readonly` → `pending_delete` → (deleted)  
Writes only when `active`.

### GDPR erasure request

`pending` → `approved` (hard delete) | `rejected`

### Invite

`pending` → `accepted` | `revoked` | `expired`

---

## 6. Settings that change rules

| Setting key | Effect | Default (verify in code) |
|---|---|---|
| `doctors_see_peer_amounts` | Peer revenue visibility | Confirm in `settings_json` / seed |
| `shared_pricelist_across_locations` | Services location_id required or not | Confirm |
| `ai_enabled` | Future; default false | N/A MVP |
| `onboarding.*` | Force redirect until complete | New clinics incomplete |
| `working_hours` | Display / scheduling UX | Defaults Europe/Sarajevo week |
| `branding_json` | Shell + PDF colors/logo | Empty |

---

*Business rules & RBAC — DentOrd QA — 2026-07-23.*
