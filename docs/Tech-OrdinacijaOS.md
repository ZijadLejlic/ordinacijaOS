# Tech — DentOrd

> Tehnička arhitektura. Produktni zahtjevi i Decision Log: `docs/PRD-OrdinacijaOS.md`.  
> Schema: `docs/DB-OrdinacijaOS.md`.  
> **Pravilo:** ne izmišljati zahtjeve mimo PRD-a; ovaj fajl ažurirati kad se arhitektura stvarno promijeni.

| Polje | Vrijednost |
|---|---|
| Status | Faza 3 done — item 25 Inventar basic |

| Izvor | PRD §0.1, §5, §8, §11 |
| Ažurirati | Pri scaffoldu i svakoj arhitekturnoj odluci |

---

## 1. Cilj dokumenta

Zaključati **kako** gradimo DentOrd (stack, patterni, granice), da agent/developer ne nagađa. Detalji featurea ostaju u PRD-u.

---

## 2. Stack (zaključano iz PRD Faza 1)

| Sloj | Izbor | Napomena |
|---|---|---|
| App | Next.js App Router | Čitati `node_modules/next/dist/docs/` prije non-trivial API-ja |
| Hosting / DB / Auth / Storage | Supabase (EU) | Data residency EU (D34) |
| UI | shadcn/ui + preset iz `components.json` | Ne inventisati nove primitive |
| Validacija | Zod na server granicama | Server Actions / Route Handlers |
| i18n | BS (default) + EN | Routing pod `[locale]` (D37) |
| Email | Resend (`dentord.com`) | From `DentOrd <noreply@dentord.com>`; aliases `support@`, `hello@` (D9, D23, D44). Brand constants: `lib/brand/constants.ts` |
| Errors | Sentry | Tag `clinic_id` gdje je safe |
| Analytics | PostHog | Bez imena pacijenata (D33) |
| Billing | Stripe od 1.1.2027 | Do tada bez charge (D4–D5) |

### Scaffold odluke (zaključano 2026-07-12)

| Stavka | Izbor |
|---|---|
| Next.js | 16.2.x (App Router) |
| React | 19.2.x |
| Package manager | npm |
| i18n | `next-intl` — locales `bs` (default), `en`; prefix always |
| UI | shadcn/ui preset `base-nova` (`components.json`) |
| Supabase clients | `@supabase/ssr` + `@supabase/supabase-js` u `lib/supabase/` |
| Validacija | Zod |
| Deploy target | TBD |
| Auth (Faza 1) | Email/password signup+login; `create_clinic_for_owner` RPC; owner TOTP MFA (D11); staff invites D9 (`/settings/users`, `/invite/[token]`); PIN operators D10 (`/pin`, bcrypt via pgcrypto RPCs); Resend; plan limit hard-block via `lib/entitlements/` |
| Entitlements (Faza 1) | `lib/entitlements/` — `getClinicEntitlements` / `assertFeature` from `plan_entitlements`; free-2026 override (SMS/AI/portal off); `assertCanInviteStaff`, `assertCanCreateLocation`, `assertCanAddPatientImage` |
| Platform admin (Faza 1) | `(platform)/platform` — gate via `app_metadata.is_platform_admin` (never `user_metadata`); service-role clinic list/detail; plan + clinic/subscription status updates; owner impersonation with `audit_events` (D41) |
| Clinic app shell (Faza 2A) | `(dashboard)/layout.tsx` + `components/dashboard/app-shell.tsx` — sidebar/mobile nav (RBAC: patients/services/settings), logout + PIN operator switch, impersonation banner |
| Patients UI (Faza 2A) | `/patients` lista+search, `/patients/new`, `/patients/[id]` karton (alergije, PDF docs, WebP images + plan limit, FDI odontogram); storage bucket `patient-files`, signed URLs (D21) |
| Services UI (Faza 2A) | `/services` — lista + search/status; owner CRUD (create/edit/activate); D16 `shared_pricelist_across_locations` → optional `location_id`; staff read-only |
| Treatment plans (Faza 2B) | Na `/patients/[id]` — plan + stavke (usluga, opcionalni FDI, status planned/in_progress/done/cancelled, procjena EUR); RBAC kao odontogram; feature `treatment_plan` |
| Calendar (Faza 2C) | `/calendar` — day/week/month; CRUD termina; hard overlap (DB EXCLUDE); DnD uz `calendar_advanced`; waitlist + auto-predlog na cancel uz `waitlist_auto`; `date-fns` + `date-fns-tz` (Europe/Sarajevo); custom grid (bez FullCalendar) |
| Invoices (Faza 2D) | `/invoices` + `/invoices/[id]` — create/void, payments (cash/card/transfer/other), debts filter, installment plans (`installments_calculator`); PDF via `@react-pdf/renderer` stored on issue; download `GET /api/invoices/[id]/pdf`; RBAC owner/accountant; feature `invoices`. Number allocate: RPC + temporary service-role fallback for Postgres 42702 until `20260714040000_fix_allocate_invoice_number` applied |
| Expenses + KPI + Excel (Faza 2E) | `/expenses` CRUD/void + profit; Excel `GET /api/reports/excel` (`exceljs`); dashboard KPI (today appts/revenue/patients, revenue by doctor, monthly trend); RBAC §3.2; feature `expenses_reports_excel` (Pro+); doctor payment aggregates via `dashboard_payment_stats` RPC (D17) |
| Locations (Faza 2F) | `/settings/locations` — owner CRUD (soft deactivate); D8 hard-block via `assertCanCreateLocation` + DB trigger (active-only count); D16 `settings_json.shared_pricelist_across_locations` toggle (enabling clears `services.location_id`) |
| Branding (Faza 2G) | `/settings/branding` — owner logo + colors (`branding_json`); feature `branding_custom` (Pro+); private bucket `clinic-branding`; applied in AppShell + invoice PDF |
| CSV import (Faza 2H) | `/settings/import` — dry-run preview + commit; patients (owner); services (owner/accountant); CSV parse+Zod; max 500 rows / 1 MB; audit `*_csv_imported` (count only) |
| Onboarding (Faza 2I) | `/onboarding` — owner 3-step wizard (clinic+hours → services/CSV → invite doctor|reception); `settings_json.onboarding` + `working_hours`; middleware force redirect; skip invite allowed |
| Email (Faza 3A) | `/settings/email` — BS/EN templates (`appointment_reminder` + CRM keys); owner edit; reception read/send; calendar manual send + test to self; `outbound_messages` log; feature `email_reminders` |
| CRM light (Faza 3B) | `/crm` inbox — birthday (7d) / recall (180d) / control (`next_control_at`); reception/owner send email or dismiss; nav badge; feature `crm_light`; audit `crm.notification_*` |
| Audit log (Faza 3C) | `/settings/audit` — owner-only; `audit_events` SELECT RLS owner; filter + pagination; payload old/new when present |
| GDPR (Faza 3C) | `/settings/privacy` + patient chart export/request; `gdpr_erasure_requests`; owner approve → `approve_gdpr_patient_erasure` hard delete + storage cleanup; JSON export `GET /api/privacy/patients/[id]/export` |
| Clinic ZIP backup (Faza 3C / §8.3) | Owner on-demand ZIP: `GET /api/privacy/clinic/export` — patients, invoices(+lines/payments), documents/images meta; audit `clinic.backup_exported` |
| Clinic lifecycle (Faza 3C / D6 / D45) | Trial/unpaid → `readonly` (7d grace) → `pending_delete` → hard delete; owner close via `/settings/privacy`; cron `GET /api/cron/clinic-lifecycle`; RLS `clinic_is_writable()` |
| E2E + tenant isolation CI (item 23) | Playwright `e2e/` — signup→MFA→onboarding step 1, termin+overlap, faktura+PDF, UI isolation; Vitest `lib/security/tenant-isolation.test.ts` — patients/appointments/storage; workflows `e2e.yml` + `security.yml` |
| Consent draw-sign (Faza 3D / D20) | `/settings/consent` — BS/EN predlošci (`general_treatment`, `data_processing`, `radiography`); karton draw-sign → PDF + PNG u `patient-files`; `consent_forms` / `consent_signatures`; feature `consent_draw_sign` (Pro+) |
| Inventar basic (Faza 3E / §6.12) | `/inventory` — materijali (qty + unit + low-stock prag); ±1 adjust; nav badge; `inventory_items` + RLS; feature `inventory_basic` (Pro+); bez auto-skidanja/barkoda/roka |
| Marketing (Faza 1) | `(marketing)/` landing + `/pricing` + signup CTA; display prices mirror PRD §4.1 |
| Observability (Faza 1) | Sentry (`instrumentation*.ts`, optional DSN); PostHog (`lib/analytics/posthog.ts`, EU host, no patient PII) |

Env template: `.env.example` → kopirati u `.env.local`.

---

## 3. Arhitekturni principi

1. **Server-first:** RSC default; Client Components samo za interaktivni UI (forme, kalendar widgeti, signature pad…).
2. **Mutacije:** dashboard CRUD → **Server Actions**. Route Handlers samo za streaming, PDF download, webhooks, slične edge caseove.
3. **Multi-tenant:** svaki business query/mutation scoped po `clinic_id`; RLS je izvor istine (D7).
4. **Entitlements:** čitati iz `plans` / features — ne hardcode plan gateova samo u UI (D42).
5. **Secrets:** anon key OK u klijentu; **service role samo server**; impersonacija auditirana (D41). Service role se koristi i za invite accept (`createUser` + `accept_clinic_invite` / `peek_clinic_invite`) i owner-init password reset — nikad u browseru.
6. **Nema** internal REST CRUD sloja “za app” dok Tech to eksplicitno ne uvede.

### Staff invite (D9) — implementirano

1. Owner (MFA ok) → `/settings/users` → email + ime + rola.
2. App generiše opaque token, čuva `sha256` u `clinic_invites.token_hash`, šalje Resend link `/{locale}/invite/{token}`.
3. Prije inserta: `assertCanInviteStaff` (aktivni profili + pending invites vs `plans.limits_json`) — hard block + upsell copy (D8/D42).
4. Accept: service role `peek_clinic_invite` → `auth.admin.createUser` → `accept_clinic_invite` → session.
5. Owner: resend, revoke, deactivate (+ global signOut), force logout, password reset email.

### PIN operators (D10) — implementirano

1. Owner (MFA ok) → `/settings/users` → PIN operatori: ime + PIN (4–6 cifara) na reception/assistant nalogu.
2. PIN nikad plain: `pgcrypto` bcrypt u `create_clinic_operator` / `update_clinic_operator_pin`; `pin_hash` column revoked od Data API select.
3. Shared desk login → middleware → `/pin` ako postoji ≥1 aktivan operator; cookie `oos_operator_id` (httpOnly).
4. `verify_operator_pin` piše audit `operator.switched` s `actor_user_id` + `operator_id`; 5 fails → 15 min lock na profilu.
5. App helper `writeAuditEvent` čita operator cookie za buduće mutacije.

---

## 4. Predložena struktura (scaffold)

Dok repo ne postoji, ovo je target — prilagoditi stvarnom scaffoldu i upisati odstupanja ovdje.

```text
app/
  [locale]/
    (marketing)/          # landing, pricing, signup CTA
    (auth)/               # login, invite accept, MFA
    (onboarding)/         # owner 3-step wizard (Faza 2I)
    (dashboard)/          # clinic app
    (platform)/           # super-admin (odvojeno)
  api/                    # samo edge case Route Handlers
components/
  ui/                     # shadcn
  ...
lib/
  supabase/               # server / browser clients
  auth/
  entitlements/
  validations/            # Zod schemas
messages/
  bs.json
  en.json
docs/
  PRD-OrdinacijaOS.md
  Tech-OrdinacijaOS.md
  DB-OrdinacijaOS.md
```

---

## 5. Auth i sesija (iz PRD)

- Signup → `clinic` + `owner` profil; free do `trial_ends_at` (2026-12-31 za naloge u free periodu) (D4).
- Nove klinike: `settings_json.onboarding.completed=false`; poslije MFA owner ide na `/onboarding` (D43).
- Staff: invite-by-email (magic link) → set password → role (D9).
- Owner: MFA (TOTP) obavezno; ostali ne (D11).
  - Enroll: `/mfa/enroll` (QR + 6-cifreni kod) odmah poslije signup/login ako owner nema verified factor.
  - Challenge: `/mfa/verify` kad session ima `aal1` a postoji verified TOTP.
  - Middleware + `resolveOwnerMfaGate()` blokira `/dashboard` dok owner nije `aal2`.
  - RLS: restrictive `owner_mfa_ok()` na business tabelama (owner s verified MFA mora `aal2`).
- Session TTL 7 dana; owner force logout svih sesija klinike (D12).
- 5 failed logins → notifikacija owneru + privremeni lock (D13).
- Shared reception/assistant: PIN operator switch; audit `actor_user_id` + `operator_id` (D10).
  - Owner CRUD via RPCs na `/settings/users`.
  - Gate: `shared_desk_needs_pin()` + cookie + `/pin`.
  - Switch: `verify_operator_pin` → cookie + audit.
- v1: 1 user ↔ 1 clinic; nema cross-clinic membership (D7).
- **Platform admin (D41):** odvojen od clinic UI.
  - Flag: `auth.users.raw_app_meta_data.is_platform_admin = true` (Auth Admin / service role only).
  - Routes: `/platform`, `/platform/clinics/[id]` under `(platform)/`.
  - Ops (list clinics, plan/status flags, entitlements view) preko `createServiceClient()` na serveru.
  - Impersonacija: session switch na clinic ownera + cookie + banner; `platform.impersonation_start/stop` u `audit_events`.
  - Grant primjer: `service.auth.admin.updateUserById(id, { app_metadata: { is_platform_admin: true } })`.

---

## 6. Storage

- Private buckets; signed URLs (kratki TTL) (D21).
- Path: `clinic_id / patient_id / ...`
- Image limiti po planu (D22); WebP kompresija.
- Bucket `patient-files` (Faza 2A): `{clinic_id}/{patient_id}/documents/{id}.pdf` i `{clinic_id}/{patient_id}/images/{id}.webp`; signed URL TTL 120s (`lib/patients/storage.ts`), generisan on-demand po zahtjevu (nema eager fetch).
- Consents (Faza 3D / D20): `{clinic_id}/{patient_id}/consents/{id}.pdf` + `{id}.sig.png`; PDF via `@react-pdf/renderer` + canvas draw-sign.
- Invoice PDF (Faza 2D): `{clinic_id}/{patient_id}/invoices/{invoice_id}.pdf` — immutable copy snimljen pri issue; Route Handler streamuje stored file (ne regeneriše template).
- Clinic branding (Faza 2G): bucket `clinic-branding`, path `{clinic_id}/logo.webp`; `branding_json.logo_path` + `colors.{background,text,accent}`; signed URL TTL 3600s za shell; invoice PDF downloada logo kao data URI.
- Upload: PDF max 20MB za dokumente; slike (bilo koji format) konvertovane u WebP (`sharp`, quality ~82, max width 2400) prije upload-a; broj slika po pacijentu limitiran planom (`assertCanAddPatientImage`).

---

## 7. Defaults (klinika)

| Setting | Default | Decision |
|---|---|---|
| Locale UI | `bs` (+ `en`) | D37 |
| Timezone | `Europe/Sarajevo` | D47 |
| Phone country | `+387` | D46 |
| Valuta prikaza | EUR sa PDV-om | PRD header |
| Peer amounts | clinic setting `doctors_see_peer_amounts` | D17 |

---

## 8. Out of scope u implementaciji (ne graditi “usput”)

Iz PRD §10 / Decision Log — posebno u 2026 free MVP:

- AI, SMS/WhatsApp, patient portal, online booking / mini site
- Stolice kao kalendar resurs (termin = doktor)
- Fiskalna kasa / državna fiskalizacija
- Dijeljenje schema/tenant s Avicenom

---

## 9. Observability

- Sentry: greške; tag `clinic_id` / `role` via `setClinicErrorContext` (bez patient PII)
- PostHog: `clinic_id`, `role`, event names — **bez** patient PII (D33); EU host default; disabled bez `NEXT_PUBLIC_POSTHOG_KEY`
- Support: email `support@dentord.com` (D44)

---

## 10. Faze implementacije (referenca)

Prati PRD §11. Tech doc se širi po fazama; ne specifikovati Enterprise module ovdje dok Faza 4 ne krene.

| Faza | Fokus |
|---|---|
| 1 | Repo, RLS, auth, entitlements, marketing skeleton, Sentry/PostHog |
| 2 | Clinical + finance core |
| 3 | SaaS ops, GDPR, audit, email/CRM |
| 4 | Stripe, AI, channels, Enterprise |

---

## 11. Changelog

| Datum | Promjena |
|---|---|
| 2026-07-12 | Skeleton iz PRD-a; TBD stavke za scaffold |
| 2026-07-12 | Scaffold: Next 16 + next-intl + shadcn base-nova + Supabase clients |
| 2026-07-12 | D9 staff invites: Resend + entitlements hard-block + `/settings/users` + `/invite/[token]` |
| 2026-07-12 | D10 PIN operators: bcrypt RPCs, `/pin` gate, audit operator_id, Vitest smoke |
| 2026-07-13 | Entitlements feature gates + location/image helpers; marketing skeleton; Sentry+PostHog wiring |
| 2026-07-13 | D41 super-admin skeleton: `(platform)/`, app_metadata gate, audited impersonation, billing flags |
| 2026-07-13 | Faza 2A: clinic `(dashboard)` AppShell — RBAC nav (patients/services/settings), mobile menu, operator switch + logout |
| 2026-07-13 | Faza 2A: patients UI — lista/new/karton (alergije, PDF docs, WebP images, FDI odontogram); signed URLs; no raw DB errors in UI |
| 2026-07-13 | Faza 2A: Patients UI — lista/new/karton, allergies, docs/images (WebP + D22 limit), odontogram on chart |
| 2026-07-13 | Faza 2A: Services UI — `/services` CRUD (owner write), search/status, D16 location field, translated errors |
| 2026-07-13 | Faza 2B: treatment plans UI on patient chart (D19) + `phase2b_treatment_plans` schema/RLS |
| 2026-07-13 | Faza 2C: `/calendar` appointments + waitlist (D14/D15/D25); EXCLUDE overlap; feature gates |
| 2026-07-13 | Faza 2D: `/invoices` + PDF Route Handler; payments append-only; installment plans; `@react-pdf/renderer` |
| 2026-07-13 | Faza 2E: `/expenses` + dashboard KPI + Excel export (`exceljs`); `dashboard_payment_stats` RPC |
| 2026-07-13 | Faza 2F: `/settings/locations` + shared pricelist toggle (D16); active-only location plan limit |
| 2026-07-13 | Faza 2G: `/settings/branding` logo+boje; `clinic-branding` bucket; AppShell + invoice PDF |
| 2026-07-13 | Faza 2H: `/settings/import` CSV patients+services; dry-run; `can_import_services` for accountant INSERT |
| 2026-07-13 | Faza 2I: `/onboarding` 3-step wizard; `settings_json.onboarding`+`working_hours`; create_clinic seeds incomplete |
| 2026-07-13 | Faza 3A: email templates + reminders (D23); `/settings/email`; calendar send; `outbound_messages` |
| 2026-07-14 | Brand **DentOrd** / `dentord.com`; Resend From `noreply@`; `lib/brand/constants.ts`; assets u `brand/` |
| 2026-07-14 | Faza 3B: CRM light `/crm` + `crm_notifications`; birthday/recall/control; `patients.next_control_at` |
| 2026-07-14 | Faza 3C: owner audit UI `/settings/audit`; GDPR export + erasure approve/hard-delete `/settings/privacy` |
| 2026-07-14 | Faza 3C: clinic ZIP backup `/api/privacy/clinic/export` (patients, invoices, docs meta; §8.3 / D45) |
| 2026-07-14 | Faza 3C: clinic lifecycle trial→readonly→hard delete (D6/D45); cron `/api/cron/clinic-lifecycle` |
| 2026-07-14 | Item 23: Playwright E2E (signup/termin/faktura/isolation) + Vitest tenant isolation patients/appts/storage CI |
| 2026-07-14 | Fix allocate_invoice_number ambiguity (migration + app fallback); nest AuditLog.events keys for next-intl |
| 2026-07-14 | Faza 3D / D20: consent templates + draw-sign PDF (`consent_forms` / `consent_signatures`) |
| 2026-07-14 | Faza 3E / §6.12: inventar basic `/inventory` + `inventory_items` + low-stock nav badge |
