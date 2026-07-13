# DB — DentOrd

> Database schema, RLS i multi-tenant modeli.  
> Produkt: `docs/PRD-OrdinacijaOS.md`. Arhitektura: `docs/Tech-OrdinacijaOS.md`.  
> **Izvor istine za runtime:** Supabase migracije. Ovaj dokument opisuje namjeru i mora se ažurirati uz schema promjene.

| Polje | Vrijednost |
|---|---|
| Status | Faza 1 applied (live Supabase) |
| Izvor | PRD §5, §4, Decision Log |
| Ažurirati | Uz svaku migraciju / RLS promjenu |
| Types | `lib/supabase/database.types.ts` |

---

## 1. Principi (zaključano)

1. Svaki poslovni red ima `clinic_id` (osim globalnih `plans` / platform tabela).
2. RLS: authenticated user vidi **samo** svoju kliniku (D7).
3. 1 auth user ↔ 1 clinic u v1 — nema cross-clinic membership.
4. Service role samo server-side; platform impersonacija → `audit_events` (D41).
5. Storage path: `clinic_id / patient_id / ...`; private + signed URLs (D21).
6. Entitlements iz `plans` → feature keys — ne hardcode samo u UI (D42).
7. GDPR hard delete samo uz owner approval flow (D35).
8. Prije novih tabela: `list_tables` / postojeća schema (Supabase MCP); ne duplicirati.

---

## 2. RLS (applied)

Helpers (SECURITY DEFINER, `search_path = public`, execute samo `authenticated`):

- `current_clinic_id()` — JWT `app_metadata.clinic_id` pa fallback na `profiles`
- `current_app_role()` — JWT `app_metadata.app_role` pa fallback na `profiles`
- `is_clinic_owner()`
- `owner_mfa_ok()` — D11: owner s verified MFA mora `aal2` (RLS restrictive)
- `create_clinic_for_owner(name, full_name, trial_ends_at?)` — signup: clinic + owner + default location + trial subscription (Professional); seeds `settings_json.onboarding` incomplete (Faza 2I)

**JWT hook (B5):** `custom_access_token_hook` upisuje `clinic_id` + `app_role` u `app_metadata` pri izdavanju tokena. Funkcija je u bazi; **mora se ručno uključiti** u dashboardu: Authentication → Hooks → Custom Access Token → `public.custom_access_token_hook`. Bez toga helperi i dalje rade preko `profiles` fallbacka.

Clinic-scoped policies koriste `clinic_id = (select current_clinic_id())`. Owner write politike su odvojene po `INSERT`/`UPDATE`/`DELETE` (ne `ALL`) da izbjegnu dupli permissive SELECT. `profiles` zadržava dvije UPDATE politike (self + owner). Self `with_check` je pojednostavljen — `role`/`is_active`/`clinic_id` immutability ide kroz `profiles_guard_sensitive_columns` trigger (izbjegava RLS rekurziju).

Advisor note: linter WARN-a da su ovi SECURITY DEFINER callable od `authenticated` — **namjerno** (signup RPC + RLS helpers). `anon` execute je revoked.

**Test:** tenant isolation automated tests = release blocker (PRD §8.1) — `lib/security/tenant-isolation.test.ts` + CI workflow `.github/workflows/security.yml`.

---

## 3. Faza 1 — Foundation tabele

Kolone su **namjera**; tipovi/constrainti se finalizuju u migraciji. `…` = TBD u implementaciji.

### 3.1 Global / platform

#### `plans`

| Kolona | Napomena |
|---|---|
| `id` | PK |
| `code` | `starter` / `professional` / `premium_ai` / `enterprise` |
| `name` | Prikaz |
| `price_eur_monthly` | Prikaz (sa PDV kontekstom u UI) |
| `limits_json` | doktori / korisnici / lokacije / images_per_patient |
| `is_active` | |

#### `plan_entitlements`

| Kolona | Napomena |
|---|---|
| `plan_id` | FK → plans |
| `feature_key` | npr. `patients_chart`, `invoices`, … (PRD §4.3) |
| `enabled` | boolean |
| metered flags | TBD kad metered billing krene (2027) |

### 3.2 Clinic & users

#### `clinics`

| Kolona | Napomena |
|---|---|
| `id` | PK |
| `name` | |
| `plan_id` | FK → plans (free 2026 = Professional entitlements) |
| `trial_ends_at` | npr. 2026-12-31 za early signup (D4) |
| `timezone` | default `Europe/Sarajevo` (D47) |
| `phone_country_default` | default `+387` (D46) |
| `branding_json` | `{ logo_path?, logo_url?, colors?: { background?, text?, accent? } }` (hex `#RRGGBB`) |
| `settings_json` | vidi §5 |
| `status` | `active` \| `readonly` \| `pending_delete` |

#### `profiles`

| Kolona | Napomena |
|---|---|
| `id` | PK = `auth.users.id` |
| `clinic_id` | FK → clinics |
| `role` | `owner` \| `doctor` \| `assistant` \| `reception` \| `accountant` \| (`technician` Enterprise) |
| `full_name` | |
| `is_active` | |
| MFA / lockout fields | Owner TOTP preko Supabase Auth MFA (`auth.mfa_factors`); app gate + `owner_mfa_ok()` RLS (D11). Auth login lockout (D13): `check_login_lockout` / `record_failed_login` / `clear_login_lockout` RPC + `loginAction`. |
| `pin_failed_count` / `pin_locked_until` | D10 desk PIN lock (5 fails → 15 min) |

#### `clinic_operators`

PIN quick switch za shared reception/assistant (D10).

| Kolona | Napomena |
|---|---|
| `id` | PK |
| `clinic_id` | |
| `profile_id` | shared nalog (`reception` / `assistant` only — trigger) |
| `display_name` | |
| `pin_hash` | bcrypt (`pgcrypto`); **nije** u Data API SELECT za authenticated |
| `is_active` | |

RPCs (authenticated): `create_clinic_operator`, `update_clinic_operator_pin`, `set_clinic_operator_active`, `verify_operator_pin`, `shared_desk_needs_pin`, `operator_belongs_to_me`.

Writes samo preko RPC (table INSERT/UPDATE revoked za authenticated).

#### `clinic_locations`

| Kolona | Napomena |
|---|---|
| `id` | PK |
| `clinic_id` | |
| `name` | |
| `address` | nullable |
| `is_active` | soft deactivate (UI); no hard delete from app |
| limite po planu | `enforce_location_limits` BEFORE INSERT + `assertCanCreateLocation` — broje **aktivne** (D8) |

Signup (`create_clinic_for_owner`) kreira default „Glavna lokacija“. Owner UI: `/settings/locations`.

#### `clinic_invites`

| Kolona | Napomena |
|---|---|
| `id` | PK |
| `clinic_id` | |
| `email` | |
| `full_name` | |
| `role` | `app_role` ≠ owner |
| `token_hash` | sha256 hex raw magic tokena (raw samo u emailu) |
| `status` | pending / accepted / revoked / expired |
| `expires_at` | default app TTL 7 dana |
| `invited_by` | profile id |
| `accepted_at` | |

Unique: jedan `pending` po `(clinic_id, lower(email))`.

RPCs (service_role): `peek_clinic_invite`, `accept_clinic_invite`. Owner app: `expire_stale_clinic_invites`.

#### `clinic_subscriptions`

Evidencija paketa / budući Stripe (D5). Do 2027 bez charge — i dalje red za plan + trial.

**RLS:** `SELECT` + `UPDATE` samo owner (`clinic_subscriptions_select_owner`, `clinic_subscriptions_update_owner`). **Nema `INSERT` policy** — namjerno: red se kreira isključivo kroz `create_clinic_for_owner` (SECURITY DEFINER) ili `service_role` (platform admin D41). Sljedeći developer ne treba dodavati INSERT policy bez eksplicitnog product odluke.

| Kolona | Napomena |
|---|---|
| `clinic_id` | |
| `plan_id` | |
| `status` | trial / active / past_due / … TBD |
| Stripe ids | NULL dok billing ne krene |

#### `audit_events`

| Kolona | Napomena |
|---|---|
| `id` | PK |
| `clinic_id` | nullable za pure platform događaje |
| `actor_user_id` | |
| `operator_id` | nullable; PIN switch |
| `event_name` | |
| `payload_json` | **bez** patient names u analytics exportu; u auditu pažljivo s PII |
| `created_at` | |

Platform impersonacija mora ostaviti trag ovdje (D41).

Eventi (Faza 1 platform): `platform.impersonation_start` / `platform.impersonation_stop`,
`platform.clinic_status_update`, `platform.clinic_plan_update`, `platform.subscription_status_update`
(payload `phase`: requested / succeeded / failed).

**Platform admin identity:** nije `profiles.role` (nema clinic membership). Flag u
`auth.users.raw_app_meta_data.is_platform_admin` → JWT `app_metadata` (nikad `user_metadata`).

---

## 4. Clinic settings (u `settings_json` ili normalizovano)

Iz PRD §5.3 — minimalni ključevi:

| Key | Default / napomena |
|---|---|
| `doctors_see_peer_amounts` | D17 |
| `shared_pricelist_across_locations` | D16 — default **true**; owner toggle na `/settings/locations`; uključivanje null-uje `services.location_id` |
| `ai_enabled` | default **false** kad feature postoji (D31) |
| `working_hours` | `{ monday…sunday: { closed, open:"HH:MM", close:"HH:MM" } }` — Faza 2I onboarding |
| `onboarding` | `{ completed, step, steps:{clinic,services,invite}, completed_at?, skipped_invite? }` — Faza 2I; **missing key = grandfathered completed** |
| timezone / phone | kolone na `clinics` (`timezone`, `phone_country_default`) |

---

## 5. Faza 2A — clinical core (implementirano)

Migracija `phase2a_clinical_core` (+ `is_valid_fdi` search_path fix). RLS + `clinic_id` na svim redovima.

| Tabela | Napomena |
|---|---|
| `services` | Cjenovnik; opcionalni `location_id` (D16); `price_eur` + `vat_rate` |
| `patients` | Karton: kontakt, anamneza, napomene, soft `is_active` |
| `patient_allergies` | `allergy_severity`: mild/moderate/severe/unknown |
| `patient_documents` | PDF meta; `storage_path` unique; path `{clinic}/{patient}/documents/{id}.pdf` |
| `patient_images` | WebP meta; plan limit enforce u app (D22) |
| `odontogram_teeth` | FDI via `is_valid_fdi()`; `tooth_status` enum |
| `odontogram_events` | Historija izmjena statusa |

### Faza 2B — treatment plans (implementirano)

Migracija `phase2b_treatment_plans` (+ revoke anon EXECUTE follow-up).

| Tabela | Napomena |
|---|---|
| `treatment_plans` | Po pacijentu; soft `is_active`; `created_by` |
| `treatment_plan_items` | Usluga (+ `service_name` snapshot), opcionalni FDI, status enum, `estimated_price_eur` |

**RLS helpers:** `can_access_treatment_plan` (owner/doctor/assistant), `can_write_treatment_plan` (owner/doctor).

### Faza 2C — appointments + waitlist (implementirano)

Migracija `phase2c_appointments` (+ revoke anon EXECUTE follow-up). Extension `btree_gist`.

| Tabela | Napomena |
|---|---|
| `appointments` | `doctor_id` → profiles; `starts_at`/`ends_at`; status enum; **EXCLUDE** `appointments_no_doctor_overlap` (D14) — no overlap same clinic+doctor when status not cancelled/no_show |
| `appointment_waitlist` | preferred doctor/service/location + date window; status waiting/offered/booked/cancelled (D25) |

**RLS helpers:** `can_access/write_appointments` (owner/doctor/assistant/reception); `can_manage_all_appointment_doctors` (owner/assistant/reception — doctors scoped to self); `can_access/write_waitlist` (owner/reception).

### Faza 2D — invoices + payments + plans (implementirano)

Migracija `phase2d_invoices` (+ revoke anon EXECUTE follow-up).

| Tabela | Napomena |
|---|---|
| `invoice_number_counters` | `(clinic_id, year)` → `last_number`; samo preko `allocate_invoice_number` RPC (row lock) |
| `invoices` | `YYYY-####` unique per clinic; status `unpaid\|partial\|paid\|void`; void umjesto DELETE; `pdf_storage_path` |
| `invoice_lines` | Denormalized `clinic_id`; snapshot description/price/`vat_rate` (0–1); INSERT-only |
| `payments` | Append-only; method `cash\|card\|bank_transfer\|other`; trigger recompute invoice status |
| `payment_plans` + `payment_plan_installments` | Rate kalkulator; app gate `installments_calculator` |

**RLS helpers:** `can_access/write_invoices` (owner/accountant only — PRD §3.2).

**Storage:** `{clinic_id}/{patient_id}/invoices/{invoice_id}.pdf` u `patient-files` (+ finance storage policies).

### Faza 2E — expenses + dashboard KPI (implementirano)

Migracija `phase2e_expenses` (+ `dashboard_payment_stats` RPC).

| Tabela / RPC | Napomena |
|---|---|
| `expenses` | Kategorije enum; void umjesto DELETE; EUR; RLS owner+accountant |
| `dashboard_payment_stats` | Agregati uplata za KPI; doktor vidi svoj (ili peer ako `doctors_see_peer_amounts`) |

**App:** `/expenses` + Excel `GET /api/reports/excel` gated `expenses_reports_excel` (Pro+); dashboard KPI RBAC po §3.2.

### Faza 2F — locations + shared pricelist (implementirano)

Tabela `clinic_locations` već postoji (Faza 1). Migracija `phase2f_locations_active_limit` usklađuje D8 limit da broji samo `is_active`.

**App:** `/settings/locations` — owner CRUD (soft deactivate); D16 `settings_json.shared_pricelist_across_locations`.

### Faza 2G — branding (implementirano)

Nema nove tabele — `clinics.branding_json` (Faza 1). Migracija `phase2g_branding`: private bucket `clinic-branding`.

| Ključ | Napomena |
|---|---|
| `logo_path` | `{clinic_id}/logo.webp` u `clinic-branding` |
| `logo_url` | legacy fallback (invoice) |
| `colors.background` / `text` / `accent` | hex `#RRGGBB`; AppShell sidebar |

**RLS storage:** member SELECT (isti `clinic_id`); owner INSERT/UPDATE/DELETE. Feature gate `branding_custom` (Pro+).

### Faza 2H — CSV import (implementirano)

Nema nove tabele. Migracija `phase2h_csv_import`:

| Helper / policy | Napomena |
|---|---|
| `can_import_services()` | owner + accountant (PRD §3.2 Import CSV) |
| `services_insert_import` | INSERT na `services` preko `can_import_services` (update/delete ostaju `can_write_services` = owner) |

**App:** `/settings/import` — dry-run + commit; patients INSERT via postojeći RLS (`can_write_patients`, app gate owner-only); max 500 redova.

### Faza 2I — in-app onboarding (implementirano)

Nema nove tabele. Migracija `phase2i_onboarding`:

| Promjena | Napomena |
|---|---|
| `create_clinic_for_owner` | Seed `settings_json.onboarding` (`completed:false`, `step:1`) za nove klinike |
| `settings_json.working_hours` | App write u koraku 1 (nema RLS change — owner `clinics_update`) |
| Grandfather | Klinike bez `onboarding` key → app tretira kao `completed` |

**App:** `/onboarding` — owner-only; middleware force redirect dok nije completed; `/settings/import` dozvoljen mid-wizard (CSV usluge). Audit: `onboarding.step1_completed` / `step2_completed` / `completed` (bez PII).

### Faza 3A — email šabloni + reminderi (implementirano)

Migracija `phase3a_email_templates` (+ seed membership guard):

| Tabela / helper | Napomena |
|---|---|
| `email_templates` | `(clinic_id, template_key, locale)` unique; MVP key `appointment_reminder`; BS+EN |
| `outbound_messages` | append-ish log (insert+status update); channel `email`; test vs appointment send |
| `can_read_email_templates` | owner + reception |
| `can_write_email_templates` | owner |
| `can_send_outbound_messages` | owner + reception |
| `seed_default_email_templates(clinic_id)` | SECURITY DEFINER; member-only; called on clinic create + lazy ensure |

**Varijable:** `{{ime}}`, `{{datum}}`, `{{vrijeme}}`, `{{ordinacija}}`, `{{doktor}}`, `{{usluga}}`.

**App:** `/settings/email` (edit owner; read/send reception); kalendar „Pošalji email podsjetnik“; feature `email_reminders`. Audit: `email_template.updated` / `email.test_sent` / `email.reminder_sent` (bez PII — ids + template_key).

**Još nije u DB (skica):**

```text
consent_forms / consent_signatures            -- draw sign (D20)
```

**Kalendar:** termin vezan za doktora; stolice nisu u MVP (D14).

**Image limits:** po planu (D22) — `assertCanAddPatientImage` pri uploadu.

**Storage buckets:** `patient-files` (private, signed URLs, TTL ~120s); `clinic-branding` (private, logo TTL ~3600s u shellu).

---

## 6. Storage (ne tabele, ali dio data modela)

| Pravilo | Detalj |
|---|---|
| Bucket | `patient-files`, `clinic-branding` (oba private) |
| Path | patients: `{clinic_id}/{patient_id}/documents\|images\|invoices/...`; branding: `{clinic_id}/logo.webp` |
| Access | signed URL, kratki TTL (patients 120s; branding shell 3600s) |
| Transform | WebP kompresija (`sharp`) |

---

## 7. Plan limits (enforce)

Hard block + upsell (D8), ne samo soft warning:

| Resurs | Starter | Professional | Premium AI | Enterprise |
|---|---|---|---|---|
| Doktori | 2 | 5 | 10 | Unlimited |
| Korisnici | 3 | 10 | 25 | Unlimited |
| Lokacije | 1 | 2 | 5 | Unlimited |
| Slike/RTG po pacijentu | 10 | 20 | 30 | 40 |

Free trial 2026 entitlements = Professional, minus SMS/AI/portal (PRD §4.3).
App layer: `lib/entitlements/features.ts` applies free-period overrides until `2027-01-01`.
Location create must call `assertCanCreateLocation`; image upload must call `assertCanAddPatientImage`.

---

## 8. Šta namjerno nije u DB v1

- Cross-clinic membership tabele
- Shared Avicena schema / tenant
- Fiskalizacija / državna kasa integracija
- AI transcript tabele dok Faza 4 / opt-in ne krene

---

## 9. Migracije i MCP

1. Preferirati postojeću schema (`list_tables`) prije inventisanja.
2. Primjenjivati migracije preko Supabase MCP kad je dostupno; inače dokumentovati blocker.
3. Nakon RLS promjena: security advisors.
4. Ažurirati ovaj fajl u istom PR / sesiji kao migracija.

---

## 10. Applied migrations (Supabase)

| Version / name | Sadržaj |
|---|---|
| `phase1_plans_and_entitlements` | `plans`, `plan_entitlements`, seed 4 plana + feature matrix |
| `phase1_clinic_tenant_tables` | `clinics`, `profiles`, locations, operators, invites, subscriptions, `audit_events` |
| `phase1_rls_and_helpers` | RLS + helpers + `create_clinic_for_owner` |
| `phase1_security_advisor_fixes` | `search_path` + revoke anon |
| `phase1_revoke_rls_auto_enable` | revoke platform helper od API rola |
| `owner_mfa_aal2_rls` | `owner_mfa_ok()` + restrictive AAL2 policies (D11) |
| `phase1_staff_invites` | unique pending email index; `peek_clinic_invite` / `accept_clinic_invite` / `expire_stale_clinic_invites`; revoke anon on invites |
| `phase1_staff_invites_revoke_execute` | tighten EXECUTE grants (service_role only for peek/accept) |
| `phase1_auth_email_exists` | `auth_email_exists(email)` for invite pre-check (service_role) |
| `phase1_pin_operators_d10` | PIN RPCs (bcrypt), column revoke `pin_hash`, desk lock fields, shared-role trigger |
| `phase1_pin_operators_revoke_anon` | revoke anon EXECUTE on D10 RPCs |
| `code_review_a1_profiles_self_update_lock` | A1: `profiles_update_self` immutability + `profiles_guard_sensitive_columns` trigger; column UPDATE grants |
| `code_review_a2_plan_limit_enforcement` | A2: `enforce_invite_limits` / `enforce_location_limits` BEFORE INSERT triggers (D8 hard block) |
| `code_review_a1_a2_revoke_trigger_execute` | Revoke RPC EXECUTE on trigger-only functions (security advisor) |
| `code_review_b2_login_lockout` | B2/D13: `check_login_lockout`, `record_failed_login`, `clear_login_lockout` |
| `code_review_b4_rls_performance` | B4: select-wrapped RLS, FK indexes, dedupe invite index, split owner write policies |
| `code_review_b5_jwt_custom_claims` | B5: `custom_access_token_hook` + JWT-first helper reads with profiles fallback |
| `phase2a_clinical_core` | services, patients, allergies, documents, images, odontogram + RLS + `patient-files` bucket |
| `phase2a_fix_is_valid_fdi_search_path` | `is_valid_fdi` search_path hardening |
| `phase2b_treatment_plans` | treatment_plans + items + RLS + RBAC helpers |
| `phase2b_treatment_plans_revoke_anon` | revoke anon EXECUTE on new SECURITY DEFINER fns |
| `phase2c_appointments` | appointments + waitlist + EXCLUDE overlap + RLS |
| `phase2c_appointments_revoke_anon` | revoke anon EXECUTE on appointment/waitlist helpers |
| `phase2d_invoices` | invoices/lines/payments/plans + counters + allocate RPC + finance RLS + invoice storage policies |
| `phase2d_invoices_revoke_anon` | revoke anon EXECUTE on invoice helpers; trigger fn not callable via API |
| `phase2d_invoice_patient_directory` | limited patient id/name RPCs for accountant invoice UX |
| `phase2d_invoice_patient_names` | batch patient name resolver for invoice list/detail |
| `phase2e_expenses` | expenses table + category enum + finance RLS |
| `phase2e_dashboard_payment_stats` (+ `_tz`) | doctor-safe payment KPI aggregates RPC |
| `phase2f_locations_active_limit` | D8: `enforce_location_limits` counts `is_active` only |
| `phase2g_branding` | private bucket `clinic-branding` + owner write / member select policies |
| `phase2h_csv_import` | `can_import_services()` (owner+accountant); services INSERT policy for CSV import |
| `phase2i_onboarding` | `create_clinic_for_owner` seeds `settings_json.onboarding` incomplete |
| `phase3a_email_templates` | `email_templates` + `outbound_messages` + RLS/RBAC + seed defaults; create_clinic seeds templates |
| `phase3a_email_seed_guard` | `seed_default_email_templates` requires active clinic membership |

---

## 11. Changelog

| Datum | Promjena |
|---|---|
| 2026-07-12 | Skeleton: principi, Faza 1 tabele, Faza 2+ skica iz PRD §5 |
| 2026-07-12 | Applied Faza 1 na live Supabase; types generisani |
| 2026-07-12 | Owner MFA (D11): `owner_mfa_ok` + restrictive RLS |
| 2026-07-12 | D9 invites: token hash flow RPCs + pending unique index + `auth_email_exists` |
| 2026-07-12 | D10 PIN operators: bcrypt RPCs, pin_hash not selectable, desk lock |
| 2026-07-13 | Documented app-layer entitlement helpers (no new migration) |
| 2026-07-13 | CODE-REVIEW A1/A2: profiles self-update lock, DB plan limit triggers, tenant-isolation test suite |
| 2026-07-13 | CODE-REVIEW B2/B4/B5: login lockout, RLS performance pass, JWT custom claims hook (dashboard enable pending) |
| 2026-07-13 | D41 platform admin skeleton (app-layer; no new table — flag in `app_metadata`) |
| 2026-07-13 | Faza 2A clinical core: patients/services/odontogram tables + Patients UI docs |
| 2026-07-13 | Faza 2A: Services UI documented — owner write via `can_write_services`; D16 location optional |
| 2026-07-13 | Faza 2B: treatment_plans / treatment_plan_items + RLS (D19) |
| 2026-07-13 | Faza 2C: appointments + appointment_waitlist + EXCLUDE overlap (D14/D25) |
| 2026-07-13 | Faza 2D: invoices/lines/payments/plans + allocate serial + PDF storage (D29) |
| 2026-07-13 | Faza 2E: expenses + dashboard_payment_stats RPC (D29) |
| 2026-07-13 | Faza 2F: locations UI + shared pricelist; active-only location limit |
| 2026-07-13 | Faza 2G: clinic-branding bucket + branding_json logo/colors (AppShell) |
| 2026-07-13 | Faza 2H: `can_import_services` + services insert for accountant CSV import (D30) |
| 2026-07-13 | Faza 2I: onboarding seed in `create_clinic_for_owner`; working_hours + onboarding in settings_json (D43) |
| 2026-07-13 | Faza 3A: email_templates + outbound_messages; appointment_reminder BS/EN; Resend send (D23) |
