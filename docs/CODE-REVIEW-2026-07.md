# Code Review — OrdinacijaOS (pre-produkcijski pregled)

> Snimljeno iz chat sesije 2026-07-13. Pregled je rađen na live Supabase schema (MCP: `list_tables`,
> RLS policies, grants, funkcije, advisors), svim migracijama, i kompletnom kodu u `app/`, `lib/`,
> `components/` uz `docs/PRD-OrdinacijaOS.md` i `docs/DB-OrdinacijaOS.md`.
>
> **Kontekst u trenutku pregleda:** implementirana je samo Faza 1 (Foundation) — multi-tenant schema,
> RLS, auth (signup/login/2FA), staff invites, PIN operatori, entitlements/limits, marketing skeleton.
> Faza 2 (pacijenti, kalendar, fakture/finansije) još ne postoji u kodu — nema `patients`,
> `appointments`, `invoices` tabela niti ruta. Review finansijskog modula je zato preventivan
> (konkretan schema/RLS prijedlog za kad se gradi), dok su DB/RLS/Auth pregledani na stvarnom,
> živom kodu i schema, s dokazima.

---

## Status (2026-07-21) — ne čitati A/B kao trenutni backlog

Faze 1–3 su implementirane. Većina A/B stavki ispod je **zatvorena** migracijama / kodom:

| Item | Status |
|---|---|
| **A1** profiles self-role lock | ✅ `code_review_a1_profiles_self_update_lock` |
| **A2** plan limit DB triggers | ✅ `code_review_a2_plan_limit_enforcement` |
| **A4** tenant isolation tests + CI | ✅ Vitest + Playwright + workflows |
| **B2** login lockout | ✅ implementirano |
| **B3** `EMAIL_FROM` silent fallback | ✅ produkcija baca grešku ako nedostaje |
| **B4/B5** RLS perf + JWT hook funkcija | ✅ u DB; **hook enable u dashboardu još ručno** |
| **B1** Leaked Password Protection | ❌ još OFF (advisor WARN) — vidi `docs/Production-Ops.md` |

Preostali ops (MX inbox, Vercel env, Supabase toggles): **`docs/Production-Ops.md`**.

---

## A) KRITIČNI PROBLEMI (moraš popraviti prije produkcije)

### A1. Privilege escalation — korisnik može sam sebe promovisati u `owner`

**Šta sam našao:** RLS politika `profiles_update_self` na `public.profiles`:

```text
cmd: UPDATE
qual: (id = auth.uid())
with_check: (id = auth.uid()) AND (clinic_id = current_clinic_id())
```

Ova politika ograničava **koji red** može biti mijenjan, ali ne ograničava **koje kolone**. Kolona
`role` ima `UPDATE`/`INSERT` grant za `authenticated` (provjereno preko
`information_schema.column_privileges`), i ne postoji trigger koji je štiti (jedini trigger na
`profiles` je `profiles_set_updated_at`).

**Zašto je problem:** Bilo koji ulogovani `doctor`/`reception`/`assistant`/`accountant` može, direktno
preko Supabase JS klijenta ili REST-a (bez ijedne linije servera), izvršiti:

```ts
await supabase.from("profiles").update({ role: "owner" }).eq("id", myUserId);
```

RLS to dozvoljava jer `with_check` provjerava samo `id` i `clinic_id`, koji ostaju isti.

**Rizik:** Totalni proboj RBAC-a. Recepcija ili doktor postaje `owner` → pristup finansijama, brisanje
korisnika, GDPR delete approval, itd. Ovo je **release blocker** — direktno krši multi-tenant-security
pravilo "Roles: respect RBAC" i D11.

**Rješenje:** Zaključaj `role` (i `clinic_id`, `is_active`) na nivou kolone za `profiles_update_self`,
ili bolje — makni self-update potpuno i prebaci sve promjene role/is_active na SECURITY DEFINER RPC koji
eksplicitno provjerava da caller nije sam sebi mijenja privilegije.

```sql
-- 1) Skini samopromjenu role/is_active iz opšte UPDATE politike
drop policy profiles_update_self on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with_check (
  id = auth.uid()
  and clinic_id = current_clinic_id()
  and role = (select role from public.profiles where id = auth.uid())      -- role se ne mijenja
  and is_active = (select is_active from public.profiles where id = auth.uid())
);

-- 2) Zabrani UPDATE na role/is_active/clinic_id kolonama za authenticated
revoke update (role, is_active, clinic_id) on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated; -- eksplicitno samo dozvoljeno
```

Owner-only promjena role/is_active ostaje kroz `profiles_update_owner_staff` politiku (koja već
postoji) — samo osiguraj da i ona ima `is_clinic_owner()` provjeru koju već ima. Napravi automatizovani
test: login kao `doctor`, pokušaj `update({role:'owner'})`, očekuj RLS grešku — ovo mora biti u
release-blocker test suite-u (PRD §8.1 tenant isolation).

### A2. Plan limiti (D8 "hard block") postoje samo u app kodu — RLS ih ne enforce-a

**Šta sam našao:** `assertCanInviteStaff` / `assertCanCreateLocation` (`lib/entitlements/limits.ts`)
rade provjeru limita **prije** nego server action pozove `.insert()`. Ali RLS politike na
`clinic_invites` i `clinic_locations` (`clinic_invites_write_owner`, `clinic_locations_write_owner`)
dozvoljavaju INSERT bilo kojem owneru za svoju kliniku, **bez provjere brojača**.

**Zašto je problem:** Owner ima punu Supabase sesiju (anon key + svoj JWT) koja može direktno pozvati
REST API, mimo servera:

```ts
// Owner na Starter planu (limit 3 usera), direktno iz browser konzole:
await supabase.from("clinic_invites").insert({
  clinic_id: myClinicId, email: "x11@test.com", full_name: "X",
  role: "reception", token_hash: "...", expires_at: "...", status: "pending",
});
```

Ovo prolazi RLS jer politika ne poznaje pojam "limit". D8 kaže **hard block**, ne "hard block ako
korisnik ide kroz UI".

**Rizik:** Danas nizak (free trial, nema naplate), ali od **1.1.2027** (Stripe) ovo je direktan
revenue-leak — klinika plaća Starter, koristi Enterprise kapacitet. I sad je rizik za kredibilitet
limita/entitlements sistema (D42: "entitlements iz `plans` — ne hardcode u UI/app-only").

**Rješenje:** Prebaci provjeru limita u DB (trigger ili SECURITY DEFINER RPC koji je jedini put za
insert), po uzoru na kako je to riješeno za `clinic_operators` (RPC-only, table insert/update revoked
za authenticated). Konkretno za `clinic_invites`:

```sql
create or replace function public.enforce_invite_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_users int;
  v_doctors int;
begin
  select p.limits_json into v_limits
  from public.clinics c join public.plans p on p.id = c.plan_id
  where c.id = new.clinic_id;

  select count(*) into v_users
  from public.profiles where clinic_id = new.clinic_id and is_active
  union all
  select count(*) from public.clinic_invites
  where clinic_id = new.clinic_id and status = 'pending';
  -- (agregiraj/sumiraj ispravno u praksi; ovo je skica)

  if (v_limits->>'users') is not null
     and v_users >= (v_limits->>'users')::int then
    raise exception 'plan_limit_users';
  end if;

  return new;
end;
$$;

create trigger clinic_invites_enforce_limits
before insert on public.clinic_invites
for each row execute function public.enforce_invite_limits();
```

Isti princip za `clinic_locations` (D8: ≤2 lokacije na Pro). App-layer
`assertCanInviteStaff`/`assertCanCreateLocation` neka i dalje postoje (za brz, friendly UX error pre
slanja), ali **DB mora biti zadnja linija odbrane**, ne samo UI.

### A3. `SUPABASE_SERVICE_ROLE_KEY` — nedostaje audit za `service.auth.admin.*` pozive u error putu

**Šta sam našao:** `lib/supabase/service.ts` je ispravno server-only (nije uvezen u client komponente,
nema `"use client"` u lancu poziva) — to je dobro. Ali `resetUserPasswordAction`,
`deactivateUserAction`, `forceLogoutUserAction` u `lib/invites/actions.ts` koriste
`service.auth.admin.*` (bypass RLS, admin API) i **ne loguju uvijek u `audit_events` prije nego što
akcija uspije** — konkretno `resetUserPasswordAction` piše audit event, ali ako Resend padne
(`sendPasswordResetEmail` baci grešku), funkcija se prekida u `catch` bloku **prije** upisa audit
eventa, pa je link već generisan (i mogao je biti iskorišten kroz logove/monitoring) a da trag ne
postoji. Manji punkt, ali za "Security stance" (D50) i audit trail (§6.15 PRD) bitno je da svaki
`service_role` admin poziv ima 100% pouzdan trag.

**Rješenje:** Upiši audit event **odmah nakon generateLink**, prije slanja emaila, sa statusom
(`requested`), a ne samo na kraju kad email uspije.

### A4. Nema automatizovanog tenant-isolation testa (release blocker po vlastitom PRD-u)

PRD §8.1 i §12.2 to eksplicitno traže kao **release blocker**, a `docs/DB-OrdinacijaOS.md` §2 kaže "još
nije implementirano". Bez ovog testa, A1/A2 tipa grešaka (i buduće regresije kad dodate
`patients`/`invoices` tabele) prolaze u produkciju neopaženo. Ovo je metaproblem koji pokriva sve
ostalo — vidi konkretan test skelet u sekciji E.

---

## B) SREDNJI PROBLEMI (preporučeno popraviti)

### B1. Leaked Password Protection je isključen (Supabase Auth)

Advisor: `auth_leaked_password_protection` (WARN). Korisnici mogu postaviti password koji je poznat iz
curenja podataka (HaveIBeenPwned check je isključen).

**Rizik:** Credential stuffing na owner nalozima (koji nose i MFA, ali staff nalozi bez MFA-a su
izloženiji).

**Rješenje:** Uključi u Supabase dashboardu → Auth → Policies → "Leaked password protection". Nema
code changea, 5 minuta posla — nema razloga da ovo ne bude uključeno već sada.

### B2. Login lockout (D13) nije implementiran u kodu, samo u schema

`profiles.failed_login_count` i `profiles.locked_until` postoje kao kolone, ali nigdje u
`lib/auth/actions.ts` (`loginAction`) se ne inkrementiraju niti provjeravaju. PIN lockout (D10) je
urađen ispravno u `verify_operator_pin()` RPC — login lockout nije.

**Rizik:** Brute-force na email+password login nije ograničen na app nivou (Supabase Auth ima svoj
rate-limit, ali D13 traži specifično: 5 failed → notify owner + 15 min lock, što je business zahtjev,
ne generički rate-limit).

**Rješenje:** Wrapuj `loginAction` — na `AuthApiError` (invalid credentials), pozovi RPC koji
inkrementira `failed_login_count`/postavi `locked_until`, i pošalje audit event + (kasnije) email
owneru. Provjeri `locked_until` prije `signInWithPassword`. Ovo zahtijeva SECURITY DEFINER RPC jer se
dešava **prije** login-a (korisnik još nije `authenticated`) — mora biti `anon`-callable ali strogo
rate-limited i bez enumeracije e-mailova (ne otkrivaj postoji-li nalog).

### B3. `EMAIL_FROM` fallback je `onboarding@resend.dev` — može procuriti u produkciju

`lib/email/resend.ts`: `process.env.EMAIL_FROM ?? "OrdinacijaOS <onboarding@resend.dev>"`. Ako env
varijabla nije setovana u Vercel produkciji, invite/reset emailovi idu sa Resend test domena → loš
deliverability, izgleda kao phishing, i D44 (support@ na kupljenom domenu) nije zadovoljen.

**Rješenje:** Baci exception u produkciji ako `EMAIL_FROM` nije setovan (isti pattern kao već imaš za
`RESEND_API_KEY`), umjesto silent fallback-a.

### B4. RLS performance — funkcije se re-evaluiraju po redu, duplirani indeksi, multiple permissive policies

Advisor (performance) je našao:
- `current_clinic_id()`, `current_app_role()`, `is_clinic_owner()`, `owner_mfa_ok()` se pozivaju bez
  `(select ...)` wrapper-a u RLS izrazima → re-evaluacija po svakom redu (`auth_rls_initplan`).
- Duplirani indeks na `clinic_invites` (`clinic_invites_one_pending_email` i
  `clinic_invites_pending_email_idx`).
- Multiple permissive SELECT/UPDATE politike na `clinic_invites`, `clinic_locations`,
  `clinic_operators`, `profiles`.
- Unindexed FK: `audit_events.operator_id`, `clinic_invites.invited_by`,
  `clinic_subscriptions.plan_id`, `clinics.plan_id`.

**Zašto je problem:** Danas 1 klinika, 2 profila — nevidljivo. Sa 100+ klinika i hiljadama redova u
`audit_events`/buduće `patients`/`appointments`, ovi RLS pozivi po redu postaju stvarni bottleneck
(svaki SELECT na `profiles` znači podupit po redu ako nije cache-ovan u planu).

**Rješenje (primjer za jednu funkciju, ponovi za sve helper funkcije u policy-jima):**

```sql
-- umjesto: qual: (clinic_id = current_clinic_id())
-- koristi select-wrapped verziju u novoj definiciji policy-ja:
alter policy audit_events_select_member
on public.audit_events
using (clinic_id = (select current_clinic_id()));
```

Dodaj indekse:

```sql
create index on public.audit_events (operator_id);
create index on public.clinic_invites (invited_by);
create index on public.clinic_subscriptions (plan_id);
create index on public.clinics (plan_id);
drop index if exists public.clinic_invites_pending_email_idx; -- zadrži samo jedan
```

Spoji multiple permissive politike u jednu `OR` kombinaciju gdje ima smisla (npr.
`clinic_locations_select_member` i write policy mogu ostati razdvojene po cmd, ali provjeri da ne
postoje dvije za isti `cmd`).

### B5. `current_clinic_id()`/`current_app_role()`/`is_clinic_owner()` su STABLE, ali svaka poziva `profiles` SELECT — razmisli o JWT custom claims

Trenutno svaki RLS check radi implicitni SELECT na `profiles` (indeksiran po PK, brzo je za sad). Kad
dođu `patients`/`appointments`/`invoices` s desetinama RLS-zaštićenih tabela i JOIN-ovima, ovo se
multiplicira. Supabase best-practice je keširanje `clinic_id`/`role` u JWT custom claims
(`auth.jwt() ->> 'clinic_id'`) putem custom access token hook, umjesto SQL SELECT-a po svakom redu.

**Preporuka:** Prije nego dodaš 10+ novih RLS-zaštićenih tabela u Fazi 2, implementiraj
[Custom Claims Hook](https://supabase.com/docs/guides/auth/auth-hooks) koji upisuje `clinic_id`/`role`
u JWT na login, i promijeni helper funkcije da čitaju iz `auth.jwt()` uz fallback na `profiles` tabelu
(za slučaj promjene role bez re-login-a, ili invalidate token na role change).

### B6. `create_clinic_for_owner` — race na "jedan user = jedna klinika"

RPC provjerava `IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id)` pa insertuje — nema `unique`
constraint koji bi to garantovao na DB nivou van ove funkcije (osim što je `profiles.id` PK = 1 red po
useru po definiciji, pa je ovo ok zapravo — PK sam sebe štiti od duplog reda). Ovo je OK, ali obrati
pažnju: ako se `signupAction` pozove dvaput paralelno (npr. duplo submit dugme), drugi RPC poziv će
dobiti "Profile already exists" exception — to je ispravno ponašanje, samo osiguraj da frontend
disable-uje dugme na submit (provjeri `auth-forms.tsx` da imaš pending state).

### B7. `clinic_subscriptions` nema RLS INSERT policy (samo SELECT/UPDATE za owner)

Red se pravi samo kroz `create_clinic_for_owner` RPC (SECURITY DEFINER, ok), ali ako kasnije budeš
trebao ručno kreirati subscription (npr. platform admin flow, D41), trenutno nema puta osim
service_role. Nije bug, ali dokumentuj namjerno (da sljedeći developer ne pomisli da nedostaje).

---

## C) OPTIMIZACIJE ZA KASNIJE (nije blokirajuće sada)

1. **Rate limiting na signup/login/invite-accept rute** — trenutno nema (ni middleware ni Vercel Edge
   Config rate-limit). Kad budeš imao javni marketing CTA sa "Registruj ordinaciju", signup endpoint je
   meta za spam/scraping. Vercel + Upstash Redis rate-limit je standardna, jeftina opcija.
2. **Caching entitlements** — `getClinicEntitlements()` radi 2 round-trip-a bazi (clinics+plans, pa
   plan_entitlements) na **svakom dashboard load-u**. Kad dodaš više stranica koje provjeravaju feature
   flagove, ovo će se pozivati desetine puta po requestu. Kandidat za `React.cache()` per-request
   memoizaciju (Next.js), ili `unstable_cache`/kratki TTL cache po `clinic_id+plan_id` (retki
   update-i).
3. **Server/Client split je trenutno OK** — sve stranice su RSC by default, forme (`auth-forms.tsx`,
   `users-forms.tsx`, `operators-forms.tsx`) su izolovani client components. Nastavi ovaj pattern kad
   dodaješ kalendar/karton (kalendar drag&drop će trebati client, ali fetch inicijalnog seta termina
   neka ide server-side).
4. **Sentry/PostHog** — wiring postoji (`instrumentation.ts`, `posthog-provider.tsx`), ali provjeri
   prije produkcije da PostHog `clinic_telemetry.tsx` stvarno ne šalje `full_name`/email u
   `properties` — brzo pregledaj payload jednom kad kreneš slati prve evente s pravim podacima (D33
   zahtjeva bez imena pacijenata, a i za staff imena treba biti oprezan).
5. **i18n poruke grešaka** — `mapRpcError` u `operators/actions.ts` parsira
   `error.message.toLowerCase().includes(...)` — fragilno ako Postgres error message format promijeni
   verziju ili lokalizaciju servera. Bolje: koristi Postgres `RAISE EXCEPTION ... USING ERRCODE` sa
   custom SQLSTATE kodovima i mapiraj po kodu, ne po substring-u teksta.
6. **`clinic_invites` — dupli unique indeks** (već pomenuto u B4) je i housekeeping i mikro-performance
   stvar.
7. **TypeScript**: tipovi generisani iz Supabase (`database.types.ts`) su čisti i konzistentni; nastavi
   generisati (`generate_typescript_types`) odmah nakon svake migracije — trenutno je to ručan korak,
   razmisli o CI koraku koji provjerava da tipovi nisu stale (diff protiv trenutne DB scheme).

---

## D) ŠTA JE DOBRO URAĐENO

Ovo je iskreno solidan temelj za multi-tenant SaaS — bolji od proporcionalno mnogo greenfield projekata
u ovoj fazi:

- **RLS je default-deny i skoro svuda dosljedan**: svaka tenant tabela ima
  `clinic_id = current_clinic_id()` pattern; nema politike koja bi propustila cross-clinic SELECT
  (osim A1 self-role bug-a, koji je column-level, ne cross-tenant).
- **`clinic_operators.pin_hash` je ispravno zaštićen**: nema SELECT/INSERT/UPDATE grant na tu kolonu za
  `authenticated`, sve ide kroz `SECURITY DEFINER` RPC-ove sa bcrypt hash-om (`pgcrypto`) i PIN lockout
  logikom (5 pokušaja → 15 min) — ovo je uzorno urađeno, bolje od login lockout-a (B2) koji nedostaje.
- **Invite token flow je kriptografski ispravan**: `randomBytes(32)` + SHA-256 hash u bazi, raw token
  samo u emailu, expire (7 dana), status state machine (`pending/accepted/revoked/expired`),
  email-match provjera u `accept_clinic_invite`, `FOR UPDATE` lock protiv race-a. Ovo je
  production-grade.
- **Owner MFA gating (D11)** je implementiran čisto — `owner_mfa_ok()` restriktivna politika +
  middleware redirect na `/mfa/enroll`/`/mfa/verify`, i logika ispravno "propušta" kad korisnik nije
  owner (ne blokira staff nepotrebno).
- **Service role izolacija je čista**: `lib/supabase/service.ts` ima jasan komentar "Never import from
  Client Components", i stvarno se ne poziva iz client-side koda.
- **Novčani tip kolone je ispravan već sada**: `plans.price_eur_monthly` je `numeric(10,2)`, ne
  `float`/`double` — dobar signal da tim razumije zašto se novac ne čuva kao floating point. Nastavi
  ovaj pattern za buduće `invoices.total_amount`, `payments.amount` itd.
- **Entitlements su data-driven (D42)**, ne hardcoded u UI — `plan_entitlements` tabela +
  `FEATURE_KEYS` konstanta + free-2026 override logika je čisto odvojena i testirana
  (`entitlements.test.ts` postoji — dobra praksa, nastavi pisati testove uz svaki novi modul).
- **Server Actions kao primarni mutation put**, u skladu sa arhitektonskim pravilom — nema "internal
  REST CRUD" za app mutacije, samo Route Handler bi trebao biti rezervisan za PDF/webhook (što ćete
  trebati za fakture).
- **Migracije su granularne i imaju security-fix pass** (`phase1_security_advisor_fixes`,
  `*_revoke_anon`, `*_revoke_execute`) — vidi se disciplina da se advisor provjerava nakon RLS
  promjena, tačno kako pravilo traži.

---

## E) PRIORITETNI PLAN POPRAVKI

Redoslijed kojim bih ja radio, sa procjenom obima:

| # | Zadatak | Zašto sad | Obim |
|---|---|---|---|
| **1** | **A1** — Zaključaj `role`/`is_active`/`clinic_id` self-update na `profiles` (RLS + column revoke) | Aktivan privilege-escalation exploit, live u produkcijskoj bazi već sada (1 klinika, 2 profila postoje) | ~1h + migracija |
| **2** | **A4** — Napiši tenant-isolation + role-escalation automated test (Playwright ili SQL-level pgTAP) pa ga stavi u CI kao release blocker | Bez ovoga, sutra kad dodaš `patients`/`invoices` tabele možeš ponoviti A1-tipa grešku neopaženo | ~half day |
| **3** | **B1** — Uključi Leaked Password Protection u Supabase dashboardu | Zero-code, 5 min, nema razloga čekati | 5 min |
| **4** | **A2** — Prebaci plan-limit enforcement u DB trigger/RPC (invites + locations) | Prije nego dodate više klinika/planova — kasnije je skuplje migrirati postojeće redove koji su možda već "iznad" limita | ~1 dan |
| **5** | **B2** — Implementiraj login lockout (D13) — RPC + wiring u `loginAction` | PRD acceptance item koji nedostaje; brute force izloženost na staff nalozima bez MFA-a | ~half day |
| **6** | **A3** — Popravi audit-trail redoslijed u `resetUserPasswordAction` (log prije/umjesto samo na uspjeh) | Mali fix, ali bitan za D41 audit garancije prije nego imate više platform admin akcija | ~1h |
| **7** | **B3** — Ukloni silent `EMAIL_FROM` fallback u produkciji | Sprječava "tihi" deliverability problem koji primijetiš tek kad partner ordinacija prijavi da ne prima email | ~15 min |
| **8** | **B4/B5** — RLS performance pass (`select`-wrap helper funkcije, indeksi, custom JWT claims) | Radi to **prije** nego dodaš 10+ novih tabela u Fazi 2 — puno jeftinije refaktorisati 9 tabela nego 25 | ~1-2 dana |
| **9** | Kad krenete na Fazu 2: **projektuj finansijski modul odmah sa auditom i append-only fakturama** (vidi prijedlog ispod) | Sprječava retroaktivno "krpljenje" finansijskog integriteta nakon što već imate prave fakture u bazi | Dizajn prije koda |

### Dodatak: konkretan prijedlog za finansijski modul (Faza 2, D29)

Pošto još ne postoji, evo konkretnog schema prijedloga da izbjegnete klasične greške (pogrešan
obračun, gubitak podataka, needing radikalni redizajn kasnije):

**Zašto je "obična" invoice/payment tabela rizična:** Ako dozvolite `UPDATE`/`DELETE` direktno na
`invoices`/`payments`, gubite historiju obračuna — nemoguće je rekonstruisati "šta je faktura govorila
u trenutku X" (za poresku kontrolu, spor s pacijentom, ili debug pogrešnog stanja). Rizik: gubitak
finansijskih podataka, nemogućnost audita, i nemogućnost promjene serijskog broja nakon fiskalnog
perioda.

**Prijedlog (append-only + status state machine, po uzoru na kako je već rađeno `clinic_invites`):**

```sql
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  location_id uuid references clinic_locations(id),
  series_year int not null,           -- YYYY-#### serijski broj po klinici (D29)
  series_number int not null,
  status text not null default 'unpaid'
    check (status in ('unpaid','partial','paid','void')),
  subtotal_amount numeric(12,2) not null,   -- numeric, nikad float
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  currency text not null default 'EUR',
  issued_by uuid not null references profiles(id),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,               -- void, ne DELETE
  voided_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, series_year, series_number)
);

-- Linije fakture su nepromjenjive nakon issue; korekcija = nova faktura / credit note
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  clinic_id uuid not null references clinics(id),   -- denormalizovano za RLS + brže upite
  service_id uuid references services(id),
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  vat_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null
);

-- Uplate su append-only; total paid = SUM(payments) — nikad prepisuj invoice.total
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  invoice_id uuid not null references invoices(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','card','bank_transfer','other')),
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
  -- NAPOMENA: nema UPDATE/DELETE politike za authenticated — greške se
  -- korigiraju kroz "reversal" red (negativan iznos + razlog), nikad brisanjem.
);
```

Ključne odluke koje ovo rješava:

- **Nema `DELETE`/`UPDATE` RLS politike na `payments`/`invoice_lines`** za `authenticated` — samo
  `INSERT` (append-only). Greška u uplati se **ne briše**, pravi se korekcioni red — inače gubite audit
  trag i mogućnost rekonstrukcije duga.
- **Serijski broj (`series_year`/`series_number`) je `unique` po klinici** — spriječava duple brojeve
  faktura (zakonski problem u BiH/regiji).
- **`status` je state machine sa `check` constraint**, ne free-text — sprječava nekonzistentne
  vrijednosti.
- **`invoice_lines.clinic_id` je denormalizovano** — bez toga bi RLS politika morala JOIN-ovati kroz
  `invoices` na svaki red, što je i sporije i teže za pisanje sigurne politike (klasična greška:
  zaboravi JOIN u RLS `USING` i cross-tenant leak postane moguć na child tabeli).
- **Dug pacijenta** = izvedena vrijednost (`invoices.total_amount − SUM(payments.amount)`), nikad
  zasebna "trenutno stanje" kolona koja se ručno ažurira — to je čest izvor "pogrešnog obračuna" jer se
  dvije nezavisne cifre razsinhroniziraju. Ako treba brzina za dashboard, napravi **materialized view**
  ili denormalizovanu read-model tabelu koju refresh-uješ triggerom, ali nikad izvor istine.
- **PDF export**: generiši iz `invoices`+`invoice_lines` u trenutku download-a (Route Handler, ne
  Server Action — tačno kako arhitektura pravilo kaže "Route Handlers only for streaming, PDF
  download"), i **snimi generisani PDF u Storage**
  (`{clinic_id}/{patient_id}/invoices/{invoice_id}.pdf`) čim se faktura izda — ne generiši on-the-fly
  svaki put, jer ako promijeniš template kasnije, stare fakture moraju ostati bit-identične
  (poreski/legal razlog).

**Backup/export za finansije:** Pošto Supabase automated backups (PITR) pokrivaju platform-level DR,
klinika-level "export ZIP" (D45) treba minimalno: `invoices`+`invoice_lines`+`payments` kao CSV/JSON,
plus svi PDF-ovi iz storage-a za taj `clinic_id`. Implementiraj ovo kao Edge Function / server-side job
(ne u browseru — može biti veliko), i testiraj restore-put (increment ka drugoj test klinici) prije
nego prvi partner stvarno zatraži export.

---

## Sljedeći koraci

Prioritet: migracija za **A1** (najhitnije) i test skelet za **A4** — ova dva koraka bi trebala biti
odrađena prije bilo čega drugog iz liste.
