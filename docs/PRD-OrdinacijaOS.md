# PRD — DentOrd

## Multi-tenant Dental SaaS za stomatološke ordinacije

> **Napomena:** Ovo je izvorni poslovni dokument (PRD + SoW-lite) za greenfield proizvod **DentOrd**. Nije dio Avicena single-clinic projekta. Tehnička arhitektura ide u budući `Tech-OrdinacijaOS.md`; database schema u budući `DB-OrdinacijaOS.md` (novi repo). Ovaj fajl se kasnije kopira u greenfield repozitorij.

---

## 0. Kontrola dokumenta

| Polje | Vrijednost |
|---|---|
| Naziv projekta | DentOrd |
| Verzija dokumenta | 1.0 |
| Datum | 10. juli 2026. |
| Status | Odobreno za implementaciju (discovery zaključen) |
| Tip dokumenta | PRD + SoW-lite |
| Proizvod | Cloud SaaS za stomatološke ordinacije |
| Izvođač | Platform owner / developer |
| Repozitorij | Greenfield (novi repo; nije Avicena) |
| Domen | dentord.com |
| Primarni market | Balkan → zatim globalno |
| UI jezici (start) | BS (default), HR, SR (latinica), EN — HR/SR dijele BS sadržaj dok nema pravog prevoda |
| Valuta prikaza | EUR (cijene prikazane sa PDV-om) |

---

## 0.1 Decision Log (zaključano)

Odluke su finalne za v1 planiranje. Agent/developer **ne nagađa** mimo ovog loga.

| # | Tema | Odluka |
|---|---|---|
| D1 | Proizvod | Greenfield SaaS **DentOrd**; Avicena samo UX/pattern referenca |
| D2 | MVP paket | **Professional** (25€/mj prikaz); branding uključen |
| D3 | Van MVP u free periodu | Bez AI, bez SMS/WhatsApp, bez patient portala |
| D4 | Free trial | Self-signup, bez plaćanja; svi nalozi kreirani do 31.12.2026 = free do kraja 2026 |
| D5 | Billing start | Online plaćanje od **1.1.2027**; do tada samo evidencija uplata u app. Provider i načini plaćanja: **D54 / D55** |
| D6 | Nakon isteka free | 7 dana read-only → export → brisanje |
| D7 | Tenant model | 1 user = 1 klinika; owner vidi sve lokacije klinike |
| D8 | Professional limiti | ≤5 doktora, ≤10 korisnika, ≤2 lokacije; **hard block** + upsell alert |
| D9 | Staff nalozi | Invite-by-email (magic link) → set password → role |
| D10 | Shared desk | Reception/assistant: shared nalog + **PIN quick switch** operatora |
| D11 | 2FA | Obavezno samo za **owner**; ostali ne |
| D12 | Session | TTL **7 dana**; owner može force logout **jednog** korisnika (per-user; ne clinic-wide) |
| D13 | Lockout | 5 failed logins → **15 min** lock + `auth.login_lockout` audit (owner Audit UI). Email / in-app bell deferred until §6.16 notification center. |
| D14 | Kalendar | Termin vezan za **doktora**; stolice nisu u MVP; hard block overlap |
| D15 | Trajanje termina | Default po usluzi + ručna korekcija |
| D16 | Cjenovnik / lokacije | Owner checkbox: isti cjenovnik na svim lokacijama ili odvojen |
| D17 | Peer amounts | Per-clinic setting: doktori vide/ne vide tuđe KM |
| D18 | Odontogram | Obavezan; **FDI** notacija; vezan uz tretmane/posjete |
| D19 | Plan terapije | Jednostavan entitet u MVP (planned / in_progress / done / cancelled) |
| D20 | Potpis saglasnosti | Draw signature na uređaju |
| D21 | Storage | Private bucket + signed URLs; WebP kompresija; limiti po paketu |
| D22 | Image limits | Starter 10 / Professional 20 / Premium 30 / Enterprise 40 (+10 po tieru) po pacijentu |
| D23 | Email šabloni | Jedan default set BS/EN; klinika edituje tekst |
| D24 | CRM light | Sistem notifikacije (birthday/recall/kontrola); **recepcija šalje** |
| D25 | Waitlist | Automatski predloži sljedećeg kad se termin otkaže |
| D26 | Online booking / mini site | Samo **Enterprise** (subdomain landing + kalendar slobodnih termina bez imena) |
| D27 | Lab / technician | Samo najveći paket (Enterprise) |
| D28 | Fiskalna kasa | Nije u app; fakture/PDF/računi jesu |
| D29 | Finansije MVP | Fakture, PDV linije, serijski broj, uplate, dugovanja, rate/kalkulator, rashodi, Excel export |
| D30 | Import | CSV pacijenti + usluge |
| D31 | AI (kasnije) | Samo podaci te klinike; draft + doktor potvrđuje; opt-in u settings; klinika plaća usage; transcript 90 dana |
| D32 | Metered | SMS, WhatsApp, AI, storage overage — klinika plaća (+15% platform fee ili own keys) |
| D33 | Analytics | PostHog **bez** imena pacijenata (clinic_id, role, event) |
| D34 | Data residency | EU-only (Supabase EU) |
| D35 | GDPR delete | Hard delete iz baze uz **owner approval** |
| D36 | Access log kartona | Ne (samo change audit) |
| D37 | Jezici start | BS (default) + HR + SR (latinica) + EN. Zasebni katalozi `messages/{bs,hr,sr,en}.json`. Marketing cijene: BS u KM, HR/SR/EN u EUR. Blog MDX: hr/sr još dijele BS postove. |
| D38 | Marketing site | Full (SEO, blog, pricing, signup CTA, reviews, case studies) |
| D39 | Deploy model | Modul ide na produkciju čim je gotov; free period = testiranje s partnerima |
| D40 | Responsive | Full responsive obavezno |
| D41 | Super-admin | Impersonacija + audit; entitlements; billing flags |
| D42 | Entitlements | Tabela `plans` → `features[]` (ne hardcode u UI) |
| D43 | Onboarding | In-app 3 stepa prvo; PDF/video kasnije |
| D44 | Support | Email na support@ (Resend na kupljenom domenu) |
| D45 | Clinic close | Export → 7 dana grace → hard delete |
| D46 | Phone default | +387 format default; owner može promijeniti country default (HR/SRB…) |
| D47 | TZ default | `Europe/Sarajevo`; owner može promijeniti |
| D48 | Godišnja pretplata (2027+) | 2 mjeseca gratis vs mjesečno |
| D49 | Buyer | Primarno **vlasnik ordinacije** |
| D50 | Security stance | Alat za evidenciju; medicinske odluke donosi doktor |
| D51 | Cross-clinic membership | v1 ostaje **1 user = 1 klinika** (D7). **Poslije razmotriti**: `clinic_memberships` + aktivna klinika / switcher (npr. doktor u više ordinacija) |
| D52 | Appointment reminder send | Owner + reception + **doktor (samo svoj termin)**; edit šablona ostaje owner; CRM send ostaje owner/reception (D24) |
| D53 | Invoice issue by doctor | Doktor može **izdati fakturu**, PDF i uplate (kao accountant); rashodi/Excel i legal settings ostaju owner/accountant |
| D54 | Billing provider (mijenja D5) | **Lemon Squeezy** (Merchant of Record) umjesto Stripea — Stripe nije dostupan za prodavce iz BiH. LS vodi checkout, recurring i PDV/VAT, isplata na BiH račun. Kolone/kod ostaju **provider-agnostični** (LS → Stripe Managed Payments je vjerovatna migracija). **Preduvjet prije implementacije:** verifikovan LS nalog + potvrđen test payout na BiH račun; ako padne, fallback je Paddle (vidi §4.5) |
| D55 | Načini plaćanja pretplate | Klinika bira: **(a) kartica** — self-serve LS checkout, ili **(b) virman** — DentOrd izda domaći račun, platform admin (D41) aktivira/produži pretplatu. Oba puta pišu **isti** `clinic_subscriptions` red; entitlements (D42) i lifecycle (D6) su identični bez obzira na način plaćanja. **Virman zahtijeva registrovanu pravnu formu prodavca** (§4.5); dok je prodavac freelance/fizičko lice, dostupna je samo kartica preko MoR-a |
| D56 | Owner as doctor | Owner može **isti nalog** koristiti i kao doktora (`profiles.practices_as_doctor`). Pojavljuje se u kalendaru/fakturama; broji se kao 1 doctor seat (D8). Nema dual-role niza i nema drugog emaila za solo ordinaciju. |

---

## 1. Executive summary

**DentOrd** je moderni cloud SaaS za stomatološke ordinacije. Cilj nije samo digitalni karton, nego pomoći ordinaciji da radi efikasnije i zaradi više: kalendar, kartoni, odontogram, fakture, dashboard, email podsjetnici, CRM light, branding.

Razlikovanje od postojećih rješenja (alpinDent i slični):

- bolji UX/UI
- multi-tenant cloud od dana 1
- jasni paketi i entitlements
- put ka AI, portalu, marketingu i mini websiteu (kasnije paketi)
- self-serve registracija i owner-managed staff

**Do 31.12.2026:** svi koji se registruju dobijaju **Professional-level free trial** (bez AI, SMS, portala). Platform owner u tom periodu registruje firmu i priprema naplatu (D54).

**Od 1.1.2027:** pretplata se plaća **karticom ili virmanom — klinika bira** (D55). Neplaćeni nalozi: 7 dana read-only → export → brisanje.

**MVP definicija uspjeha do kraja 2026:** Professional core moduli rade u produkciji; 2–3 design partner ordinacije aktivno testiraju; marketing site konvertuje na signup.

---

## 2. Poslovni ciljevi i KPI

### 2.1 Ciljevi

1. Omogućiti self-serve onboarding ordinacije za &lt;15 minuta.
2. Zamijeniti papir/Excel/stari softver za dnevni rad (pacijenti, termini, fakture).
3. Dati vlasniku jasan uvid u prihod, popunjenost i trendove.
4. Izgraditi trust: tenant isolation, GDPR, audit, EU hosting.
5. Pripremiti naplativ SaaS od 1.1.2027 bez major rewrite-a.

### 2.2 KPI (2026 free period)

| KPI | Cilj |
|---|---|
| Design partner ordinacije aktivne | ≥2–3 |
| Time-to-first-appointment (nova klinika) | ≤30 min nakon signup-a |
| Tenant isolation regressions | 0 u produkciji |
| Signup → completed onboarding | ≥60% |
| Critical E2E (signup, termin, faktura PDF) | 100% green prije svakog release-a koji dira te flow-ove |
| Uptime | ≥99.5% |

### 2.3 KPI (2027+ naplata)

| KPI | Cilj |
|---|---|
| Conversion free→paid (jan 2027 cohort) | pratiti; target ≥40% partnera |
| Monthly churn | &lt;5% |
| Support first response | &lt;1 radni dan |

---

## 3. Personas i RBAC

### 3.1 Uloge

| Rola | Opis | Paket |
|---|---|---|
| `owner` | Vlasnik; finansije, useri, settings, branding, GDPR approve. **Opciono i doktor** na istom nalogu (D56 `practices_as_doctor`) | Svi |
| `doctor` | Pacijenti, karton, odontogram, plan terapije, svoji termini, tretmani, **podsjetnik na svoj termin**, **fakture/uplate** | Svi |
| `assistant` | Raspored, priprema pacijenata; shared + PIN | Pro+ |
| `reception` | Termini, osnovni podaci, slanje reminder/CRM poruka; shared + PIN | Svi |
| `accountant` | Finansije (fakture, uplate, rashodi, export) | Pro+ |
| `technician` | Lab nalozi | **Samo Enterprise** |
| `platform_admin` | Super-admin (van clinic UI) | Interni |

### 3.2 Matrica pristupa (MVP Professional)

| Modul | owner | doctor | assistant | reception | accountant |
|---|---|---|---|---|---|
| Dashboard KPI | Da | Ograničeno | Ne | Ograničeno | Finansijski |
| Pacijenti / karton | Da | Da | Read/assist | Osnovno | Ne |
| Odontogram / plan terapije | Da | Da | Read | Ne | Ne |
| Kalendar | Da | Svoji (+ filter) | Da | Svi | Ne |
| Fakture / uplate | Da | Da (D53) | Ne | Ne | Da |
| Rashodi / Excel | Da | Ne | Ne | Ne | Da |
| Email šabloni | Da | Send\* | Ne | Read/send | Ne |
| CRM notifikacije / waitlist | Da | Ne | Ne | Da | Ne |
| Korisnici / invite | Da | Ne | Ne | Ne | Ne |
| Settings / branding | Da | Ne | Ne | Ne | Ne |
| Import CSV | Da | Ne | Ne | Ne | Da (usluge) |
| Audit log UI | Da | Ne | Ne | Ne | Ne |
| Inventar basic | Da | Da | Da | Da | Ne |

\* Dashboard KPI: doktor vidi iznose na **vlastitim** unosima; tuđi KM zavise od clinic settinga `doctors_see_peer_amounts` (D17).
\* Email: doktor **šalje podsjetnik samo za svoj termin** iz kalendara (D52); ne edituje šablone i nema `/settings/email`. CRM send ostaje owner/reception (D24).
\* Fakture (D53): doktor izdaje/PDF/uplate; **ne** rashodi/Excel; legal invoice settings ostaju owner.

### 3.3 Staff invite flow (zaključano)

Moderni self-serve model:

1. Owner završi signup → kreira se `clinic` + `owner` profil.
2. Owner ide na **Settings → Korisnici → Pozovi**.
3. Unosi email, puno ime, rolu; sistem šalje **magic link** (Resend).
4. Pozvani postavlja lozinku i ulazi.
5. Sistem enforce-a plan limite prije slanja invite-a (hard block + upsell).
6. Owner može: deaktivirati, ponovo poslati invite, reset lozinke, force logout.

**Shared reception / assistant:**

- Jedan invited user nalog (broji se u limitu korisnika).
- Owner definiše **operatore** (ime + PIN).
- Nakon logina, obavezan PIN switch; aktivni operator se piše u audit (`actor_user_id` + `operator_id`).

```text
Owner_signup → Clinic_created → Invite_staff_email
  → Magic_link_set_password → Role_assigned
  → Optional_PIN_operators → Enforce_plan_limits
```

### 3.4 Auth pravila

- Owner: username/email + password + **TOTP 2FA obavezno**.
- Ostali: email + password (iz invite flow-a); 2FA nije obavezna.
- Session refresh TTL: **7 dana**.
- 5 uzastopnih failed login pokušaja na nalog → privremeni lock (**15 min**) + `audit_events` `auth.login_lockout` vidljiv owneru u Audit UI. Push email / in-app bell (§6.16) nije MVP.
- Owner: **Force logout** jednog staff korisnika (sve sesije tog naloga; ne cijele klinike).

---

## 4. Paketi i entitlements

### 4.1 Cjenovnik (prikazati na marketing siteu odmah)

| Paket | Cijena | Namjena |
|---|---|---|
| Starter | 15€/mj | Male / solo ordinacije |
| **Professional** | **25€/mj** | MVP i free trial default |
| Premium AI | 35€/mj | AI + napredna analitika + inventar+ |
| Custom / Enterprise | 60€/mj+ | Portal, mini site, lab, neograničeno, marketing |

Godišnje (od 2027): ekvivalent **10 mjeseci** (2 gratis).

Cijene u EUR, prikaz **sa PDV-om**. Tačan poreski tretman usklađuje se kad firma bude registrovana.

### 4.2 Limiti (enforce hard)

| Resurs | Starter | Professional | Premium AI | Enterprise |
|---|---|---|---|---|
| Doktori | 2 | 5 | 10 | Unlimited |
| Korisnici | 3 | 10 | 25 | Unlimited |
| Lokacije | 1 | 2 | 5 | Unlimited |
| Slike/RTG po pacijentu | 10 | 20 | 30 | 40 |

Prekoračenje: **nije dozvoljeno**. UI alert: “Za ovo treba veći paket”.

### 4.3 Feature matrix (entitlements)

| Feature key | Starter | Pro | Premium | Enterprise |
|---|---|---|---|---|
| `patients_chart` | ✓ | ✓ | ✓ | ✓ |
| `odontogram` | ✓ | ✓ | ✓ | ✓ |
| `treatment_plan` | ✓ | ✓ | ✓ | ✓ |
| `calendar_basic` | ✓ | ✓ | ✓ | ✓ |
| `calendar_advanced` | — | ✓ | ✓ | ✓ |
| `invoices` | ✓ | ✓ | ✓ | ✓ |
| `expenses_reports_excel` | — | ✓ | ✓ | ✓ |
| `installments_calculator` | — | ✓ | ✓ | ✓ |
| `email_reminders` | ✓ | ✓ | ✓ | ✓ |
| `branding_custom` | — | ✓ | ✓ | ✓ |
| `crm_light` | — | ✓ | ✓ | ✓ |
| `waitlist_auto` | — | ✓ | ✓ | ✓ |
| `consent_draw_sign` | — | ✓ | ✓ | ✓ |
| `inventory_basic` | — | ✓ | ✓ | ✓ |
| `sms_whatsapp` | — | metered* | metered* | metered* |
| `ai_copilot` | — | — | opt-in metered | opt-in metered |
| `patient_portal` | — | — | — | ✓ |
| `mini_website` | — | — | — | ✓ |
| `online_booking` | — | — | — | ✓ |
| `lab_technician` | — | — | — | ✓ |
| `marketing_campaigns` | — | — | — | ✓ |

\* SMS/WhatsApp dostupni od Pro naviše kao **metered** add-on (nije u free MVP periodu dok se ne uključi naplata kanala).

**Free trial 2026:** entitlements = **Professional**, minus `sms_whatsapp`, `ai_copilot`, `patient_portal` (portal ionako Enterprise).

### 4.4 Metered billing (2027+)

Dodatno se plaća (prikazati cijene + **+15%** platform fee), ili owner poveže **vlastite** provider API keys (SMS/WhatsApp/AI) i snosi trošak direktno:

- SMS
- WhatsApp
- AI tokeni
- Storage overage

Prije slanja/metered akcije: UI pokazuje **procjenu troška** gdje je moguće.

### 4.5 Naplata pretplate (2027+) — D54 / D55

Dva **ravnopravna** puta plaćanja. Klinika bira šta joj odgovara; ishod je isti red u `clinic_subscriptions` i isti entitlements.

#### A) Kartica — self-serve preko Lemon Squeezyja

- Lemon Squeezy je **Merchant of Record**: on izdaje račun kupcu, naplaćuje karticu i rješava PDV/VAT po zemlji kupca. DentOrd ne implementira vlastiti tax engine.
- **Radi i dok je prodavac fizičko lice** (freelance, bez registrovane firme) — račun klinici izdaje LS, ne DentOrd; LS prima individualce uz W-8BEN. Prihod se i dalje prijavljuje u BiH i redovna djelatnost povlači obavezu registracije (§14).
- Owner u appu bira paket → LS checkout. `custom_data` nosi **`clinic_id`** (+ `user_id` samo za audit) — tenant je klinika (D7), ne user.
- LS webhook (`subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_payment_success`, `subscription_payment_failed`) upisuje stanje u `clinic_subscriptions`.
- Mapiranje LS variant → `plans.id` živi u bazi/configu. **LS nikad ne određuje feature set** — entitlements se i dalje čitaju iz `plans` (D42).
- Ekonomika: MoR fee je procentualan + fiksni dio po transakciji, što na Starteru (15€/mj) boli. **Godišnje plaćanje (D48) je preporučeni default** kod kartice.
- PayPal kao **način plaćanja kupca** unutar LS checkouta je OK ako ga LS store ima uključen — MoR, webhook i payout ostaju nepromijenjeni. **PayPal kao samostalna naplata (mimo MoR-a) nije opcija** — vidi §14.
- Fallback ako LS ne prihvati BiH prodavca ili payout ne prođe: **Paddle** (također MoR, ne ovisi o Stripe infrastrukturi). Provideri koji voze na Stripe Connectu (Polar, Creem, Dodo) nisu opcija dok je prodavac u BiH.

#### B) Virman / bankovni transfer

- Za klinike koje ne plaćaju karticom — u BiH je to očekivano stanje (poslovni račun + knjigovodstvo, često nema kartice za recurring u EUR).
- DentOrd izdaje **domaći račun**; nakon evidentirane uplate platform admin (D41) postavlja plan, status i `current_period_end`. Akcija se **auditira** (`audit_events`).
- Podržava godišnju pretplatu (D48) i Enterprise ugovore (cijena "od 60€/mj", dogovorno).
- Ovaj put **ne ovisi o vanjskom provideru** — naplata može krenuti i prije nego što je LS nalog verifikovan.
- **Preduvjet: registrovana pravna forma** (obrt / samostalna djelatnost ili d.o.o.). Fizičko lice ne može izdati račun koji klinika proknjiži kao trošak, a `ugovor o djelu` pretvara kliniku u poreskog obveznika po odbitku — neupotrebljivo za pretplatu od 15–35€/mj. **Dok prodavac nije registrovan, virman put je nedostupan i naplata ide isključivo karticom preko MoR-a.**

#### Zajedničko za oba puta

- Status pretplate hrani **postojeći clinic lifecycle (D6)**: neplaćeno → 7 dana read-only → export → brisanje. Ne pravi se paralelni mehanizam gašenja.
- `past_due` / prvi neuspjeli payment **ne gasi pristup odmah** — gašenje ide isključivo kroz lifecycle grace.
- Otkazana pretplata vrijedi **do kraja plaćenog perioda**.
- Način plaćanja je vidljiv na klinici (kartica / virman) da support i platform admin znaju šta gledaju.

---

## 5. Multi-tenant i data model (high-level)

### 5.1 Principi

- Jedna aplikacija, više klinika.
- Svaki red poslovnih podataka ima `clinic_id`.
- RLS na Postgresu: user vidi samo svoju kliniku.
- 1 auth user ↔ 1 clinic (nema cross-clinic membership u v1).
- Storage path: `clinic_id / patient_id / ...`
- Super-admin koristi service role samo na serveru; impersonacija se auditira.

### 5.2 Ključni entiteti (skica)

```text
clinics
  id, name, plan_id, trial_ends_at, timezone, phone_country_default,
  branding_json, settings_json, status (active|readonly|pending_delete)

profiles
  id → auth.users, clinic_id, role, full_name, is_active, mfa...

clinic_operators   -- PIN quick switch za shared naloge
  id, profile_id, display_name, pin_hash, is_active

clinic_locations
  id, clinic_id, name, address, ...

plans / plan_entitlements / clinic_subscriptions

patients, patient_allergies, patient_documents, patient_images
odontogram_teeth / odontogram_events
treatment_plans / treatment_plan_items
services (optionally per location)
appointments (doctor_id, patient_id, location_id, service_id?, status)
appointment_waitlist
invoices / invoice_lines / payments / payment_plans / expenses
email_templates / outbound_messages
consent_forms / consent_signatures
audit_events
clinic_invites
```

Detaljna schema, indeksi i RLS → budući `DB-OrdinacijaOS.md`.

### 5.3 Clinic settings (checkbox / toggle primjeri)

- `doctors_see_peer_amounts`
- `shared_pricelist_across_locations`
- `ai_enabled` (default **false** kad feature postoji)
- radno vrijeme, timezone, phone country default
- branding: logo URL, boje (background, text, accent)

---

## 6. Feature specs — MVP (Professional core)

### 6.1 Signup i onboarding

**Signup (marketing CTA):**

- Email, lozinka, ime ordinacije, ime vlasnika
- Kreira clinic + owner
- `trial_ends_at = 2026-12-31` za sve signup-e u 2026
- Bez payment stepa

**In-app onboarding (3 stepa):**

1. Osnovni podaci ordinacije + radno vrijeme + **checkbox „Ja radim s pacijentima“** (D56; default uključeno za prvi prolaz)
2. Dodaj prve usluge (ili CSV import)
3. Pozovi barem jednog doktora ili recepciju

PDF/video tutorijali: kasnije.

### 6.2 Pacijenti i karton

- Kontakt, medicinska historija, alergije, napomene
- Dokumenti (PDF), slike/RTG (WebP, max quality-preserving compression)
- Limit slika po paketu (Pro = 20)
- Historija tretmana / posjeta
- GDPR: export JSON/ZIP; delete request → **owner must approve** → hard delete

### 6.3 Odontogram (FDI)

- Standardna FDI mapa (11–48)
- Statusi zuba i površina; događaji vezani za posjetu/tretman
- Obavezno u kartonu da se zna na kojem zubu je šta rađeno

### 6.4 Plan terapije

- Entitet odvojen od pojedinačne posjete
- Stavke: usluga, zub (opciono), status `planned|in_progress|done|cancelled`, procjena cijene
- Posjeta može “zatvoriti” stavku plana
- Omogućava pregled budućeg rada bez miješanja s današnjom fakturom

### 6.5 Kalendar

- Veza: **doktor** (+ lokacija ako ih ima više). Bookable = `role=doctor` ili owner s `practices_as_doctor` (D56)
- View: dan / sedmica / mjesec
- Default trajanje iz usluge; korekcija dozvoljena
- Statusi: npr. `pending_confirmation`, `confirmed`, `completed`, `cancelled`, `no_show`
- **Hard block** preklapanja istog doktora
- Drag & drop (uz re-validaciju overlap-a)
- Boje termina (po statusu ili usluzi)
- Online booking **nije** u MVP (Enterprise)

### 6.6 Waitlist

- Pacijent na listu čekanja za doktora/uslugu/lokaciju
- Na cancel: sistem automatski predloži / ponudi sljedećeg (notifikacija recepciji; opciono email pacijentu kad kanal postoji)

### 6.7 Finansije

- Fakture: serijski broj po klinici (`YYYY-####`), linije, PDV, logo/pečat na PDF
- Statusi: `unpaid | partial | paid | void`
- Uplate: način (gotovina/kartica/virman/ostalo) — **samo evidencija** do Stripe 2027
- Dugovanja lista
- **Plan rata / kalkulator** (iznos, broj rata, datumi, stanje)
- Rashodi + profit pregled + Excel export (Pro)
- Bez fiskalne kase / e-fiskalizacije u app

### 6.8 Dashboard

- Današnji termini, današnji prihod, broj pacijenata
- Prihod po doktoru
- Novi pacijenti / izgubljeni pacijenti
- Mjesečni trendovi

### 6.9 Email sistem

- Default šabloni BS/EN (termin reminder, itd.) s `{{ime}}`, `{{datum}}`, …
- Klinika edituje tekst (jedan set, ne per-user)
- Slanje preko Resend (platform domen → kasnije clinic custom from po mogućnosti)
- SMS/WhatsApp: kasnije, metered, klinika plaća

### 6.10 CRM light

- Sistem generiše in-app obavijesti: birthday, recall, kontrolni pregled
- Recepcija eksplicitno šalje poruku
- Ne šalje se potpuno autonomno bez ljudske akcije u MVP

### 6.11 Dokumenti i saglasnosti

- Predlošci dokumenata (Pro)
- Potpis: **draw signature**
- Čuvanje u private storage

### 6.12 Inventar (basic Pro)

- Stanje materijala
- Low-stock upozorenje
- Automatsko skidanje / barkod / rok: Premium+ (kasnije)

### 6.13 Branding (Pro)

- Logo u app headeru
- Custom boje (pozadina, tekst, accent)
- Bez custom domena za app

### 6.14 Import

- CSV pacijenti
- CSV / lista usluga
- Validacija + error report; dry-run pregled prije commit-a

### 6.15 Audit log

- Ko, šta, kada, stara/nova vrijednost
- Obuhvat: pacijenti, termini, fakture, settings, user invite/deaktivacija, GDPR delete
- Owner UI za pregled
- Nema patient-facing “ko je gledao karton” access log u v1

### 6.16 Notifikacije (in-app bell)

- CRM eventi, waitlist, nova rezervacija na odobrenje (kad Enterprise booking postoji), security (failed logins), trial expiry upozorenja

---

## 7. Marketing website (kritično)

Javni prodajni site DentOrd (isti Next.js projekat, public route group).

### 7.1 Jezici i SEO

- BS (default) + HR + SR (latinica) + EN
- Zasebni UI katalozi `messages/{bs,hr,sr,en}.json`. Marketing cijene: BS u KM, HR/SR/EN u EUR.
- Full SEO: meta, sitemap, OG, blog, hreflang za `bs`/`hr`/`sr`/`en`
- Cookie consent + analytics (PostHog i/ili Plausible)

### 7.2 Stranice (v1)

- Home (hero brand-first, jedan CTA)
- Funkcije
- Paketi / Pricing (sve 4 cijene vidljive + badge “Free do 31.12.2026”)
- Zašto DentOrd / case studies
- Demo (screenshots + live demo seed klinika)
- Blog
- Recenzije (sekcija; puni se nakon feedbacka ~10 dana od signup-a)
- FAQ
- Kontakt + **Pozovi me** forma
- Signup (direktno iz CTA)
- Privacy Policy, Terms of Service, DPA (obraditelj)

### 7.3 CTA

Primarni: **Registruj ordinaciju** → odmah signup (ne “zakazivanje dema” kao jedini put).  
Sekundarni: Pozovi me / kontakt.

### 7.4 Social proof

- Početi bez imenovanih klijenata ako nema dozvole
- Kako stižu klijenti: tražiti feedback nakon ~10 dana → ubaciti u recenzije uz dozvolu

### 7.5 Email

- Resend na kupljenom domenu
- `support@`, transactional (invite, reminder, security), marketing po potrebi

---

## 8. Security, GDPR, backup, monitoring

### 8.1 Security

- Supabase Auth + RLS na svim clinic tabelama
- Private storage; **signed URLs** (kratki TTL); nikad public medical files
- Owner 2FA (TOTP)
- Lockout + owner alert (audit `auth.login_lockout`) nakon 5 failova
- Force logout
- Secrets samo server-side; odvojen staging/prod
- AI (kad postoji): draft-only; disclaimer “alat za evidenciju, odluku donosi doktor”
- Tenant isolation automated tests = **release blocker**
- Platform admin impersonation uvijek u `audit_events`

### 8.2 GDPR / privacy

- EU data residency
- Patient data export
- Erasure: request → owner approval → hard delete DB + storage objekte te klinike/pacijenta
- Privacy controls u settings
- PostHog: **bez imena pacijenata**; koristiti `clinic_id`, `role`, feature event names
- Cookie banner na marketing siteu

### 8.3 Backup

- Platform: Supabase automated backups
- Clinic: on-demand **export ZIP** (pacijenti, računi, dokumenti meta) za owner-a
- Pri zatvaranju naloga: export → 7 dana grace → hard delete

### 8.4 Monitoring & analytics

- Sentry: greške (tag `clinic_id` gdje je safe)
- PostHog: product analytics (anonimizirano)
- Support: email `support@`

### 8.5 Incident response (v1 ručni)

1. Detekcija (Sentry / report)
2. Platform owner procjenjuje scope
3. Obavijest **clinic owner**-u u cilju **≤72h** ako je personal data breach
4. Owner odlučuje o komunikaciji prema pacijentima (uz smjernice)
5. Post-incident zapis u internom logu

Formalni playbook kasnije; proces postoji od dana 1.

---

## 9. Billing timeline

| Period | Ponašanje |
|---|---|
| Do 31.12.2026 | Self-signup free; Professional entitlements (bez AI/SMS/portal); nema naplate |
| 1.1.2027 | Pretplate aktivne — kartica (Lemon Squeezy) **ili** virman, po izboru klinike (D54/D55); trial/grace pravila za postojeće |
| Neplaćeno nakon free/trial | 7 dana **read-only** → export dostupan → brisanje |
| Metered add-ons | Uključeno uz transparentan +15% ili own keys |

Svi nalozi kreirani prije 1.1.2027 tretiraju se kao free do kraja 2026.

Online naplata usluga pacijentima (avans preko portala): **nadogradnja poslije** core pretplata.

---

## 10. Out of scope (eksplicitno)

| Stavka | Napomena |
|---|---|
| Fiskalna kasa / državna fiskalizacija | Van app |
| Patient portal u MVP | Enterprise |
| Mini website / online booking u MVP | Enterprise |
| AI Copilot / AI doktor / AI recepcija | Premium+ |
| SMS/WhatsApp u 2026 free MVP | Kasnije metered |
| Stolice kao kalendar resurs | Nije MVP (termin = doktor) |
| Cross-clinic user membership | Nije v1; **poslije razmotriti** (D51) — doktori u više ordinacija |
| Custom domen za clinic app | Ne; Enterprise site = subdomain platforme |
| Lab/technician modul | Enterprise |
| Google/Outlook sync | Kasnije |
| Računovodstveni ERP konektori | Nije planirano dok market ne traži |
| Avicena DB / shared tenant | Zabranjeno |

---

## 11. Phased roadmap

### Faza 1 — Foundation

> Progress (2026-07-13): **1–7** done (repo, RLS, auth+MFA+invites+PIN, entitlements, **super-admin skeleton**, marketing, Sentry+PostHog). Faza 1 foundation complete.

1. ~~Greenfield repo (Next.js, Supabase, i18n BS/HR/SR/EN, shadcn)~~
2. ~~Multi-tenant schema + RLS~~
3. ~~Auth, owner 2FA, invites, PIN operators~~
4. ~~Plans / entitlements~~ *(feature gates + free-2026 overrides; location/image hard-block helpers; invite limits)*
5. ~~Super-admin skeleton~~ *(D41: `/platform`, app_metadata gate, audited impersonation, plan/status flags)*
6. ~~Marketing site skeleton + signup~~
7. ~~Sentry + PostHog (bez PII)~~ *(SDK wired; aktivno kad su DSN/key u env)*

### Faza 2 — Core clinical & finance

8. ~~Pacijenti, dokumenti, slike (WebP), odontogram FDI~~ *(slice 2A implementirano: karton, alergije, PDF/WebP storage, FDI odontogram; plan terapije još nije)*
9. ~~Plan terapije~~ *(slice 2B: `treatment_plans` / items na kartonu; statusi planned/in_progress/done/cancelled)*
10. ~~Kalendar~~ *(slice 2C: hard overlap EXCLUDE, day/week/month, waitlist auto-predlog; DnD = `calendar_advanced`)*
11. ~~Fakture, uplate, rate, PDF~~ *(slice 2D: `/invoices`, serial YYYY-####, PDV linije, payments, payment_plans + installments_calculator gate, immutable PDF)*
12. ~~Rashodi, dashboard KPI, Excel~~ *(slice 2E: `/expenses`, void, Excel export, dashboard KPI + `dashboard_payment_stats`)*
13. ~~Lokacije + shared pricelist toggle~~ *(slice 2F: `/settings/locations`, D8 active-only limit, D16 `shared_pricelist_across_locations`)*
14. ~~Branding~~ *(slice 2G: `/settings/branding`, `branding_json` logo+boje, AppShell + invoice PDF; feature `branding_custom`)*
15. ~~CSV import~~ *(slice 2H: `/settings/import` dry-run+commit; pacijenti owner; usluge owner/accountant; `can_import_services` RLS)*
16. ~~In-app onboarding~~ *(slice 2I: `/onboarding` 3 stepa; `settings_json.onboarding` + `working_hours`; force redirect owner)*

### Faza 3 — SaaS ops & trust

17. ~~Email šabloni + reminderi~~ *(slice 3A: `/settings/email` BS/EN edit; kalendar send; `email_templates` + `outbound_messages`; feature `email_reminders`)*
18. ~~CRM light notifikacije~~ *(slice 3B: `/crm` inbox; birthday/recall/control; `crm_notifications`; feature `crm_light`; recepcija šalje)*
19. ~~Audit log UI~~ *(slice 3C: `/settings/audit`; owner-only RLS SELECT; filter + pagination)*
20. ~~GDPR export/delete (owner approve)~~ *(slice 3C: `/settings/privacy` + patient chart; `gdpr_erasure_requests`; hard delete RPC; JSON export API)*
21. ~~Clinic export ZIP / backup UX~~ *(slice 3C: `/settings/privacy` ZIP; `GET /api/privacy/clinic/export`; pacijenti+računi+docs meta; D45)*
22. ~~Trial expiry → readonly → delete job~~ *(slice 3C: `clinic_is_writable` RLS; owner close; cron `/api/cron/clinic-lifecycle`; hard delete RPC)*
23. ~~E2E + tenant isolation CI~~ *(Playwright: signup→onboarding, termin, faktura+PDF, isolation UI; Vitest RLS patients/appointments/storage; `.github/workflows/e2e.yml` + `security.yml`)*
24. ~~Consent draw-sign + doc templates~~ *(slice 3D: `/settings/consent` BS/EN predlošci; karton draw-sign → PDF; `consent_forms` / `consent_signatures`; feature `consent_draw_sign`)*
25. ~~Inventar basic~~ *(slice 3E: `/inventory`; stanje + low-stock; `inventory_items`; feature `inventory_basic`)*

### Faza 4 — Premium / Enterprise / 2027 billing

26. Pretplate: Lemon Squeezy checkout + webhook **i** virman/manual aktivacija (D54/D55) + metered
    - **Povučeno naprijed: implementacija + testiranje u septembru 2026** (LS test mode), produkcija tek nakon zelenog testa. **Naplata i dalje kreće 1.1.2027 — D5 se ne mijenja.** Cilj je da billing bude gotov i odležan prije nego što prvi račun ode klijentu, a ne da se piše pod pritiskom u decembru.
27. AI copilot (opt-in, draft, 90d transcripts)
28. SMS/WhatsApp metered
29. Patient portal + OTP/magic link
30. Mini website subdomain + online booking (confirm by staff)
31. Lab/technician
32. Marketing campaigns / loyalty
33. Advanced analytics (LTV, no-show, predikcije)

**Release politika 2026:** završen modul → produkcija → partner UAT; free period služi testiranju.

---

## 12. Acceptance criteria i test plan

### 12.1 MVP acceptance (Professional core)

- [x] Signup → create clinic → onboarding step 1 *(Faza 2I: `/onboarding`; MFA → wizard)*
- [x] Owner može uraditi signup bez kartice i dobiti clinic s `trial_ends_at=2026-12-31`
- [x] Owner pozove doktora i recepciju emailom; oni postave lozinku i uđu s ispravnom rolom
- [x] Shared reception: PIN switch radi; audit bilježi operatora
- [x] Plan limiti hard-blockaju 6. doktora / 11. usera / 3. lokaciju na Pro *(helpers + DB triggers; location UI: `/settings/locations` + `assertCanCreateLocation`; image helper na storage)*
- [x] Pacijent karton: alergije, dokumenti, RTG WebP, FDI odontogram, plan terapije *(zatvaranje stavke iz posjete još nije — follow-up)*
- [x] Termin se kreira s default trajanjem usluge; overlap istog doktora je blokiran *(Faza 2C: `/calendar` + DB EXCLUDE; waitlist auto-predlog na cancel)*
- [x] Faktura PDF s brojem, PDV, logom; uplata partial/paid; plan rata *(Faza 2D: issue + storage PDF; logo iz branding_json ako postoji; plan rata = Pro+)*
- [x] Dashboard prikazuje današnje KPI i prihod po doktoru *(Faza 2E; RBAC §3.2; doctor peer amounts D17)*
- [x] Owner može dodati lokaciju (do plana) i uključiti/isključiti shared pricelist *(Faza 2F; D8/D16)*
- [x] Email reminder šablon edit + slanje (test) *(Faza 3A: `/settings/email` + kalendar send; Resend; outbound log)*
- [x] Branding: logo + boje vidljivi u app shellu *(Faza 2G; feature `branding_custom`)*
- [x] CSV import pacijenata i usluga *(Faza 2H: dry-run + commit; RBAC §3.2)*
- [x] GDPR export; delete zahtjev čeka owner approve pa hard delete *(Faza 3C: JSON export + erasure queue)*
- [x] Clinic ZIP backup (pacijenti, računi, docs meta) *(Faza 3C: `/settings/privacy` + `/api/privacy/clinic/export`)*
- [x] Trial expiry → readonly → delete *(Faza 3C: lifecycle job + owner close; D6/D45)*
- [x] Klinika A ne može pročitati podatke klinike B (automatski test)
- [x] Storage objekti nisu javno listable; samo signed URL
- [x] Full responsive: login, kalendar, karton, faktura na mobilnom *(2026-07-21: day view bez forced 640px; month compact + badge; calendar toolbar; odontogram scroll; invoice search stack; chart/invoice header CTAs)*
- [x] Marketing: pricing vidljiv, CTA signup, Privacy/Terms/DPA linkovi, cookie banner *(1c: SEO metadata/OG/JSON-LD + cookie banner + PostHog gate; core page content još u Fazi 2)*

### 12.2 E2E prioritet (CI release blockers)

1. **Signup → create clinic → onboarding step 1**
2. **Zakazivanje termina** (doctor + patient + no overlap)
3. **Kreiranje fakture + PDF download**

Dodatni blocker: **tenant isolation** suite (clinic A vs B na patients, appointments, storage paths).

### 12.3 UAT

- Testeri: platform owner + 1 doktor + 1 recepcija iz partner ordinacije
- Demo seed klinika (“Demo Dental”) za sales/test, odvojena od pravih tenanata
- Shadow mode: partneri mogu paralelno 7–14 dana po svom tempu (nije hard gate)
- Bug report: email na `support@`
- **Checklist + partner poruka:** `docs/UAT-Partner.md`

### 12.4 Performance targets

- Kalendar (5 doktora, 1 dan): &lt; 2s
- Pretraga pacijenata: &lt; 1s

### 12.5 Regression

- CI: lint, typecheck, unit, Playwright E2E (tri flow-a + isolation)
- Ručni smoke checklist: `docs/UAT-Partner.md` §1.2 (moduli bez E2E pokrivenosti)

---

## 13. Legal appendix (draft — za pravni review)

> **Upozorenje:** Tekstovi ispod su radni draftovi prilagođeni DentOrd modelu (SaaS, EU, medicinska evidencija kao alat). Nisu zamjena za advokata. Prije produkcijskog naplatnog perioda (2027) obavezna pravna revizija u nadležnoj jurisdikciji (BiH / ciljna država firme).

### 13.1 Privacy Policy — outline + draft clauses

**Svrha:** Obavijestiti korisnike (ordinacije) i posjetioce marketing sitea kako DentOrd obrađuje podatke.

**Sekcije:**

1. Ko smo (controller vs processor)
2. Koje podatke prikupljamo (account, clinic, patient data uneseni od klinike, usage analytics, cookies)
3. Pravni osnovi (ugovor, legitimni interes, pristanak za cookies/marketing)
4. Uloga klinike: klinika je **voditelj obrade** za podatke pacijenata; DentOrd je **obradaitelj**
5. Čuvanje i lokacija (EU)
6. Djelioci (Supabase, Vercel, Resend, Sentry, PostHog, Lemon Squeezy od naplate 2027)
7. Periodi čuvanja (trial, pretplata, nakon brisanja, AI transcript 90 dana)
8. Prava ispitanika (pristup, ispravka, brisanje, prenosivost, prigovor)
9. Sigurnost (šifrovanje u tranzitu, RLS, access control)
10. Djeca / maloljetnici (podaci samo preko klinike)
11. Kontakt za privacy zahtjeve
12. Izmjene politike

**Draft — uloge:**

> Kada stomatološka ordinacija (“Klinika”) unosi podatke o pacijentima u DentOrd, Klinika određuje svrhu i sredstva obrade tih podataka i djeluje kao voditelj obrade. DentOrd pruža softver i infrastrukturu i djeluje kao obradaitelj u skladu s Ugovorom o obradi podataka (DPA). Za podatke o korisničkim nalozima Klinike i podatke prikupljene na marketing stranici, DentOrd može djelovati kao voditelj obrade.

**Draft — analytics:**

> Koristimo alate za analitiku proizvoda kako bismo razumjeli korištenje funkcija. Ne šaljemo imena i prezimena pacijenata u analytics alate. Identifikatori događaja vezani su za kliniku i ulogu korisnika, ne za identitet pacijenta.

### 13.2 Terms of Service — outline + draft clauses

**Sekcije:**

1. Prihvatanje uslova
2. Opis usluge (SaaS za upravljanje ordinacijom)
3. Nalozi i odgovornost Klinike za staff pristup (uključujući shared PIN)
4. Free trial do 31.12.2026; kasnije plaćene pretplate
5. Prihvatljiva upotreba (zabrana zloupotrebe, pokušaja bypass RLS, skeniranja)
6. Medicinski disclaimer
7. Intelektualno vlasništvo
8. Korisnički sadržaj i licenca za hosting
9. Naknade, PDV, metered troškovi, neplaćanje → readonly → brisanje
10. Suspendovanje i raskid
11. Ograničenje odgovornosti
12. Odšteta
13. Mjerodavno pravo / sporovi (TBD po registraciji firme)
14. Kontakt

**Draft — medicinski disclaimer:**

> DentOrd je softverski alat za evidenciju i administraciju. Ne pruža medicinski savjet, dijagnozu ni terapiju. Sve kliničke odluke donosi ovlašteni zdravstveni radnik. AI funkcije (ako su uključene) generišu nacrte koje korisnik mora pregledati i potvrditi prije spremanja u karton.

**Draft — trial i brisanje:**

> Tokom besplatnog perioda do 31.12.2026. usluga se pruža “as is” radi evaluacije. Nakon isteka plaćenog ili besplatnog perioda, DentOrd može prevesti nalog u režim samo-za-čitanje na do 7 dana, omogućiti izvoz podataka, a zatim trajno obrisati podatke Klinike u skladu s politikom čuvanja.

### 13.3 DPA (Data Processing Agreement) — outline + draft clauses

**Strane:** Klinika (Controller) ↔ DentOrd (Processor)

**Sekcije:**

1. Predmet i trajanje
2. Priroda obrade (hosting, storage, email delivery, backup)
3. Vrste podataka (identifikacioni, kontakt, zdravstveni podaci koje unese Klinika)
4. Kategorije ispitanika (pacijenti, zaposleni Klinike)
5. Obaveze Processor-a (upute Controller-a, povjerljivost, sigurnost, subprocessors)
6. Lista podobradaitelja (Supabase, Vercel, Resend, …) + pravo na obavijest o izmjeni
7. Međunarodni transferi (EU default; SCC ako ikad zatreba)
8. Prava ispitanika — pomoć Controller-u
9. Breach notification (cilj: bez nepotrebnog odgađanja, orijentir 72h prema Controller-u)
10. Brisanje / povrat podataka nakon raskida
11. Audit prava (razumni interval, NDA)
12. Potpisi / prihvatanje pri signup-u (clickwrap)

**Draft — upute:**

> Processor obrađuje podatke pacijenata isključivo radi pružanja DentOrd usluge Klinici i po dokumentovanim uputama Controller-a (uključujući konfiguraciju u aplikaciji). Processor ne koristi podatke pacijenata za treniranje javnih AI modela trećih strana bez eksplicitnog ugovornog osnova i Controllera.

### 13.4 Marketing site legal UX

- Checkbox pri signup-u: prihvatam Terms + Privacy; DPA se smatra prihvaćenim kao dio Terms za processiranje patient data
- Linkovi u footeru na svim public stranicama
- Cookie banner: essential vs analytics consent

---

## 14. Open items

| Stavka | Status |
|---|---|
| Finalni domen / pravno ime firme | domen **dentord.com** (brand **DentOrd**); pravno ime firme još TBD |
| Pravna forma prodavca prije 1.1.2027 | Trenutno freelance (fizičko lice) — dovoljno do kraja free perioda jer se ništa ne naplaćuje (D4). Za virman put (D55) treba **obrt / samostalna djelatnost ili d.o.o.**; d.o.o. nije nužan. Odlučiti s knjigovođom prije prve naplate |
| PayPal kao payout kanal iz LS-a | **Slab fallback u BiH:** PayPal nalog registrovan u BiH ne može držati balance, a povlačenje ide samo na Visa Classic / Visa Debit (Mastercard/Maestro ne rade). Primarni payout ostaje bankovni transfer |
| PayPal kao samostalni sistem naplate | **Odbačeno.** PayPal je procesor, ne Merchant of Record → PDV/VAT i izdavanje računa ostaju na nama (nemoguće kao fizičko lice, §4.5), a cijeli subscription lifecycle bismo gradili sami. Uz to BiH ordinacije PayPal ne koriste kao B2B način plaćanja. Ostaje samo kao način plaćanja **unutar** LS checkouta |
| Tačan PDV / poreski ID na fakturama platforme | Nakon registracije firme |
| Mjerodavno pravo u Terms | Nakon registracije firme |
| Vanjski pen-test prije masovne naplate 2027 | Preporučeno; timing TBD |
| Exact metered unit cijene (SMS/AI) | Objaviti prije uključivanja kanala |
| Lemon Squeezy: verifikacija BiH prodavca + test payout | **Blokira D54 implementaciju; rok = prije početka septembra 2026.** Otvoriti nalog, W-8BEN, prodati test proizvod i potvrditi da payout sjedne na BiH račun **prije** pisanja integracije. LS review nakon Stripe akvizicije zna trajati, pa se pokreće odmah — ne zadnje sedmice. Ako padne → Paddle |
| Poreski tretman MoR računa za BiH klinike | Provjeriti s knjigovođom (usluga iz inostranstva / obračun PDV-a kod primaoca). Utiče na to koliko klinika realno bira virman umjesto kartice |

---

## 15. Reference

- Discovery odluke: ovaj dokument §0.1 Decision Log
- Konkurrentni kontekst: alpinDent i slični dental practice management alati
- Avicena (`PRD.md`, `PRD2.md`): samo inspiracija za UX; **ne** dijeliti schema/tenant

---

*Kraj PRD DentOrd v1.0 — 10. juli 2026.*
