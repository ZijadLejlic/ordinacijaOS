# DB — OrdinacijaOS

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
- `create_clinic_for_owner(name, full_name, trial_ends_at?)` — signup: clinic + owner + default location + trial subscription (Professional)

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
| `branding_json` | logo, boje |
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
| `address` | … |
| limite po planu | enforce u app + DB gdje ima smisla (D8) |

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

---

## 4. Clinic settings (u `settings_json` ili normalizovano)

Iz PRD §5.3 — minimalni ključevi:

| Key | Default / napomena |
|---|---|
| `doctors_see_peer_amounts` | D17 |
| `shared_pricelist_across_locations` | D16 |
| `ai_enabled` | default **false** kad feature postoji (D31) |
| radno vrijeme | TBD struktura |
| timezone / phone | mogu biti i kolone na `clinics` |

---

## 5. Faza 2+ — skica entiteta (još bez finalnih kolona)

Proširiti ovaj dokument **kad** se implementira modul. Imena iz PRD §5.2:

```text
patients, patient_allergies, patient_documents, patient_images
odontogram_teeth / odontogram_events          -- FDI (D18)
treatment_plans / treatment_plan_items        -- D19
services                                      -- optional per location (D16)
appointments                                  -- doctor_id; hard block overlap (D14)
appointment_waitlist                          -- D25
invoices / invoice_lines / payments / payment_plans / expenses
email_templates / outbound_messages
consent_forms / consent_signatures            -- draw sign (D20)
```

**Kalendar:** termin vezan za doktora; stolice nisu u MVP (D14).

**Image limits:** po planu (D22) — enforce pri uploadu.

---

## 6. Storage (ne tabele, ali dio data modela)

| Pravilo | Detalj |
|---|---|
| Bucket | private |
| Path | `{clinic_id}/{patient_id}/...` |
| Access | signed URL, kratki TTL |
| Transform | WebP kompresija |

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
