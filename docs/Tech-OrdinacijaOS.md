# Tech — OrdinacijaOS

> Tehnička arhitektura. Produktni zahtjevi i Decision Log: `docs/PRD-OrdinacijaOS.md`.  
> Schema: `docs/DB-OrdinacijaOS.md`.  
> **Pravilo:** ne izmišljati zahtjeve mimo PRD-a; ovaj fajl ažurirati kad se arhitektura stvarno promijeni.

| Polje | Vrijednost |
|---|---|
| Status | Skeleton (Faza 1) |
| Izvor | PRD §0.1, §5, §8, §11 |
| Ažurirati | Pri scaffoldu i svakoj arhitekturnoj odluci |

---

## 1. Cilj dokumenta

Zaključati **kako** gradimo OrdinacijaOS (stack, patterni, granice), da agent/developer ne nagađa. Detalji featurea ostaju u PRD-u.

---

## 2. Stack (zaključano iz PRD Faza 1)

| Sloj | Izbor | Napomena |
|---|---|---|
| App | Next.js App Router | Čitati `node_modules/next/dist/docs/` prije non-trivial API-ja |
| Hosting / DB / Auth / Storage | Supabase (EU) | Data residency EU (D34) |
| UI | shadcn/ui + preset iz `components.json` | Ne inventisati nove primitive |
| Validacija | Zod na server granicama | Server Actions / Route Handlers |
| i18n | BS (default) + EN | Routing pod `[locale]` (D37) |
| Email | Resend | Invite magic link, support@ (D9, D44) |
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

---

## 6. Storage

- Private buckets; signed URLs (kratki TTL) (D21).
- Path: `clinic_id / patient_id / ...`
- Image limiti po planu (D22); WebP kompresija.

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

- Sentry: greške
- PostHog: `clinic_id`, `role`, event names — **bez** patient PII (D33)
- Support: email `support@` (D44)

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
