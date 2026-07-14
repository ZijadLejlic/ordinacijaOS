# Website — DentOrd marketing site

## Smjernice za dizajn, sadržaj i realizaciju (v1)

> Ovaj dokument je izvor istine za izradu javnog prodajnog sitea **dentord.com** (PRD §7, D38).
> Realizacija se radi po ovom dokumentu. Ako nešto nije definisano ovdje ni u PRD-u — ne izmišljati, nego dopuniti dokument.

---

## 0. Kontrola dokumenta

| Polje | Vrijednost |
|---|---|
| Status | Zaključan za v1 realizaciju |
| Datum | 2026-07-14 |
| Vlasnik | Zijad |
| Zavisi od | `docs/PRD-OrdinacijaOS.md` (§7, D38, D49), `lib/brand/constants.ts` |

### 0.1 Zaključane odluke (Q&A 2026-07-14)

| # | Odluka |
|---|---|
| W1 | Isti Next.js projekat, **public route group** `app/[locale]/(marketing)/` — ne poseban repo/CMS |
| W2 | Ton: prijateljski-profesionalan, obraćanje na **"Vi"**; buyer = vlasnik ordinacije (D49) |
| W3 | Hero vizual: **pravi screenshot dashboarda** u browser/laptop okviru |
| W4 | Boje: **strogo brand paleta** iz `lib/brand/constants.ts` — bez novih boja |
| W5 | Fontovi: **Geist** (tekst/UI) + **Fraunces** (veliki naslovi) — isti kao app |
| W6 | Tour: **interaktivna scroll stranica** — korak po korak, screenshoti + anotacije |
| W7 | Tour živi na **posebnoj stranici** `/tour`; sažetak na Home linka na nju |
| W8 | **Live demo klinika u v1** — read-only seed klinika, javni demo pristup |
| W9 | Pricing: samo mjesečne cijene + badge "Besplatno do 31.12.2026"; godišnje samo kao napomena (od 2027) |
| W10 | Recenzije: sekcija **dizajnirana ali sakrivena** dok ne stignu prave recenzije |
| W11 | Blog: struktura definisana u ovom dokumentu, **realizacija kasnije** |
| W12 | v1 je "Zašto DentOrd" (benefiti/poređenje); **case studies kasnije** |
| W13 | Kontakt/Pozovi me: **email na support@ (Resend) + zapis u `leads` tabelu** |
| W14 | Animacije: **suptilne** (fade/slide na scroll, hover mikrointerakcije) |
| W15 | Ikonice: **Lucide** svugdje, konzistentno s appom |
| W16 | Imagery: **samo UI screenshoti + brand grafika** — bez stock fotki ljudi |
| W17 | SEO: **BiH primarno**, regija (HR/SRB/CG) sekundarno kroz isti BS sadržaj |
| W18 | Analytics: **PostHog + cookie consent banner** (D33 — bez ličnih podataka) |
| W19 | **Samo light tema** na marketing siteu |
| W20 | Dokument sadrži **gotov copy draft BS + EN** za sve sekcije |

---

## 1. Cilj i strategija

### 1.1 Šta site mora postići

1. **Prodati registraciju** — primarna konverzija je signup ("Registruj ordinaciju"), ne "zakaži demo" (PRD §7.3).
2. **Objasniti proizvod za 30 sekundi** — vlasnik ordinacije mora s Home stranice shvatiti šta DentOrd radi i zašto je bolji od papira/Excela/konkurencije.
3. **Ukloniti strah** — podaci pacijenata su osjetljivi: EU hosting, GDPR, backup i sigurnost moraju biti vidljivi na svakoj ključnoj stranici.
4. **Pokazati, ne pričati** — tour, live demo i screenshoti su glavni prodajni alat (nemamo još recenzije, W10).

### 1.2 Publika

- **Primarno**: vlasnik ordinacije (D49) — često i sam doktor, 30–60 god., nije nužno tehnički potkovan, cijeni vrijeme i jasnoću. Odlučuje o kupovini.
- **Sekundarno**: doktori i recepcija — utiču na odluku, zanima ih dnevni rad (kalendar, karton, brzina).

### 1.3 Ključne prodajne poruke (redoslijed prioriteta)

1. **Sve na jednom mjestu** — pacijenti, karton, odontogram, termini, fakture, zalihe.
2. **Besplatno do 31.12.2026** — bez kartice, bez rizika, puni Professional paket.
3. **Napravljen za naš region** — bosanski jezik, EUR + PDV, +387, Europe/Sarajevo.
4. **Vaši podaci su sigurni** — EU serveri (Supabase EU, D34), GDPR, dnevni backup, potpuna izolacija klinika.
5. **Počnite za 5 minuta** — signup → 3 koraka onboardinga → radite.

### 1.4 Ton glasa (W2)

- Obraćanje na **"Vi"** (poštovanje, B2B), ali toplo i ljudski — ne korporativno-hladno.
- Kratke rečenice. Konkretne koristi umjesto marketinških fraza ("Uštedite 5 sati sedmično na administraciji", ne "Revolucionarno rješenje").
- Bez medicinskih tvrdnji — DentOrd je **alat za evidenciju**; medicinske odluke donosi doktor (D50).
- BS je primarni jezik copy-ja; EN je prevod, ne obratno (D37).

---

## 2. Brand i vizuelni identitet

### 2.1 Boje (W4 — strogo iz `lib/brand/constants.ts`)

| Token | Hex | Upotreba |
|---|---|---|
| `blue` | `#0B6EF5` | Primarni CTA, linkovi, aktivni elementi, brand naglasci |
| `blueDeep` | `#0047C7` | Hover/pressed stanje CTA, gradijenti (blue → blueDeep) |
| `cyan` | `#2EC8F0` | Sekundarni akcent: ikonice, badge, dekorativne linije, gradijent detalji |
| `navy` | `#0F1B3D` | Naslovi, glavni tekst, footer pozadina, tamne sekcije |
| `mist` | `#E8F4FF` | Pozadine istaknutih sekcija, ikonica kontejneri, hover pozadine |
| `wash` | `#F5FAFF` | Opšta pozadina naizmjeničnih sekcija (umjesto čisto bijele) |

Pravila:

- **Bijela** (`#FFFFFF`) je osnovna pozadina; sekcije se izmjenjuju bijela / `wash` / `mist` radi ritma. Footer i max. jedna "dark" sekcija po stranici koriste `navy`.
- Tekst: naslovi `navy`, body `navy` na 75–80% opaciteta (ili izveden muted ton), nikad čisto crna.
- CTA dugme: uvijek `blue`, hover `blueDeep`. **Jedna primarna CTA boja na cijeloj stranici** — ništa drugo ne smije biti isto plavo dugme.
- Gradijent (štedljivo): `blue → cyan` za hero pozadinske forme i badge; ne za tekst osim eventualno jedne riječi u hero naslovu.
- Success/error/warning: koristiti postojeće semantičke tokene iz app teme (ne uvoditi nove).

### 2.2 Tipografija (W5)

| Uloga | Font | Detalji |
|---|---|---|
| Display / hero naslovi | **Fraunces** | 600–700, `letter-spacing: -0.02em`, optical size auto |
| H2/H3 sekcijski naslovi | **Fraunces** | 600 |
| Body, UI, dugmad, nav | **Geist** | 400/500/600 |
| Kod / brojke u tabelama | **Geist Mono** | po potrebi (pricing brojevi mogu Geist) |

Tipografska skala (desktop → mobile):

| Element | Desktop | Mobile |
|---|---|---|
| Hero H1 | 56–64px / 1.1 | 36–40px |
| H2 (sekcija) | 40px / 1.15 | 28–30px |
| H3 (kartica/podsekcija) | 24px / 1.3 | 20px |
| Body large (hero subtitle) | 20px / 1.6 | 18px |
| Body | 16–17px / 1.65 | 16px |
| Caption / eyebrow | 13–14px, uppercase, `tracking 0.08em`, boja `blue` | isto |

Pravila:

- Svaka sekcija ima "eyebrow" label (mala uppercase linija iznad H2, npr. "KARTON PACIJENTA") u `blue` — daje ritam i skenabilnost.
- Max širina teksta: 65ch za paragrafe.

### 2.3 Ikonice (W15)

- **Lucide** (`lucide-react`, već u projektu) — jedina biblioteka.
- Veličine: 20px inline, 24px u feature karticama, 28–32px u ikonica-kontejneru.
- Feature ikonice stoje u kontejneru: 48×48px, `border-radius: 12px`, pozadina `mist`, ikonica `blue`, `stroke-width: 2`.
- Mapiranje (koristiti dosljedno na svim stranicama):

| Modul | Lucide ikonica |
|---|---|
| Pacijenti i karton | `Users` |
| Odontogram | `Smile` |
| Plan terapije | `ClipboardList` |
| Kalendar / termini | `CalendarDays` |
| Waitlist | `ListPlus` |
| Fakture / finansije | `Receipt` |
| Izvještaji | `BarChart3` |
| Email podsjetnici | `MailCheck` |
| CRM / recall | `HeartHandshake` |
| Dokumenti i saglasnosti | `FileSignature` |
| Inventar | `Package` |
| Branding | `Palette` |
| Sigurnost / GDPR | `ShieldCheck` |
| EU hosting | `Server` |
| Podrška | `LifeBuoy` |
| Onboarding / brzi start | `Rocket` |

### 2.4 Imagery (W16, W3)

- **Samo pravi UI screenshoti** + brand grafika. Bez stock fotografija ljudi/ordinacija.
- Screenshoti se prikazuju u **browser okviru** (minimalan chrome: tri tačkice + address bar sa `app.dentord.com`) ili laptop mockup-u; mobilni prikazi u phone okviru (D40 — pokazati responsive).
- Screenshot standard: seed demo klinika sa **izmišljenim ali realističnim BS podacima** (pacijenti "Amina Hodžić", "Emir Begić"...), light tema, 2× rezolucija (retina), WebP.
- Sjena ispod okvira: mekana, velika (`0 25px 60px -15px rgb(15 27 61 / 0.25)`), plus 1px border `mist`.
- Dekorativni elementi: blage gradijent mrlje (`blue`/`cyan`, blur 100px+, opacity 10–15%) iza hero okvira i CTA sekcija; tanke tačkaste mreže (dot grid) u `mist`.
- Logo: `public/brand/logo.webp` (full) u navbaru, `logo-mark.png` za favicon/kompaktne kontekste.

### 2.5 Animacije (W14 — suptilno)

- Biblioteka: **Framer Motion** (dodati dependency) ili CSS-only gdje je trivijalno; ne uvoditi GSAP/parallax biblioteke.
- Standard ulazna animacija sekcija: `opacity 0→1` + `translateY 16px→0`, `duration 0.5s`, `ease-out`, trigger na 20% viewport ulaska, **jednom** (ne ponavljati na scroll-up).
- Stagger unutar grida kartica: 60–80ms po kartici.
- Hover: kartice `translateY(-3px)` + jača sjena, 150ms; dugmad blagi scale/brightness, 120ms; linkovi underline slide-in.
- Hero: logo/naslov/subtitle/CTA stagger na load (ukupno < 0.8s), screenshot okvir fade + blagi rise.
- Tour stranica: sticky screenshot pane sa crossfade zamjenom slika po koraku (vidi §5).
- **Obavezno**: `prefers-reduced-motion` → sve animacije off (samo opacity ili ništa). Nikakav layout shift zbog animacija (rezervisati prostor).
- Zabranjeno: auto-play karuseli, parallax, animacije duže od 0.8s, animirani brojači osim eventualno jednog u "stats" sekciji.

### 2.6 Layout i spacing

- Container: `max-width: 1200px`, padding 24px mobile / 32px tablet.
- Vertikalni ritam sekcija: 96–128px padding desktop, 64px mobile.
- Grid: 12 kolona; feature kartice 3 kolone desktop → 2 tablet → 1 mobile.
- Border radius: kartice 16px, dugmad 10px, screenshot okviri 12px, badge pill.
- Full responsive obavezno (D40): sve sekcije definisati mobile-first; navigacija na mobile = sheet/drawer.

---

## 3. Informaciona arhitektura

### 3.1 Rute (W1)

Public route group u istom projektu: `app/[locale]/(marketing)/`. Default locale **BS** bez prefiksa, EN na `/en/...` (postojeći `next-intl` setup + middleware).

| Ruta (BS) | Ruta (EN) | Stranica |
|---|---|---|
| `/` | `/en` | Home |
| `/funkcije` | `/en/features` | Funkcije |
| `/cijene` | `/en/pricing` | Cijene |
| `/zasto-dentord` | `/en/why-dentord` | Zašto DentOrd |
| `/tour` | `/en/tour` | Product tour (W6/W7) |
| `/demo` | `/en/demo` | Demo (screenshots + live demo pristup, W8) |
| `/faq` | `/en/faq` | FAQ |
| `/kontakt` | `/en/contact` | Kontakt + "Pozovite me" forma |
| `/blog` | `/en/blog` | Blog (struktura sad, sadržaj kasnije — W11) |
| `/privacy` | `/en/privacy` | Privacy Policy (PRD §13.1) |
| `/terms` | `/en/terms` | Terms of Service (PRD §13.2) |
| `/dpa` | `/en/dpa` | DPA (PRD §13.3) |
| `/signup` | — | Postojeći auth flow (izvan marketing groupa) |

### 3.2 Navigacija

**Navbar** (sticky, bijela pozadina + blur + donji border `mist` nakon scrolla):

- Lijevo: logo (link na Home).
- Sredina: Funkcije · Cijene · Tour · Zašto DentOrd · FAQ.
- Desno: language switcher (BS/EN) · "Prijava" (ghost link → `/login`) · **"Registruj ordinaciju"** (primarni CTA button → `/signup`).
- Mobile: logo + hamburger → drawer sa svim linkovima, CTA na dnu drawera full-width.

**Footer** (`navy` pozadina, svijetli tekst):

- Kolona 1: logo (svijetla varijanta ili mark), tagline "Smarter clinic. Better care.", kratki opis (1 rečenica).
- Kolona 2 "Proizvod": Funkcije, Cijene, Tour, Demo, FAQ.
- Kolona 3 "Kompanija": Zašto DentOrd, Blog, Kontakt.
- Kolona 4 "Pravno": Privacy Policy, Terms of Service, DPA (obavezno na svim public stranicama — PRD §13.4).
- Dno: © 2026 DentOrd · support@dentord.com · badge red: `ShieldCheck` "GDPR" · `Server` "EU hosting" · jezik switcher.

### 3.3 CTA sistem (PRD §7.3)

- **Primarni CTA**: "Registruj ordinaciju besplatno" → `/signup`. Pojavljuje se: navbar, hero, nakon svake 2–3 sekcije, završna CTA sekcija na svakoj stranici.
- **Sekundarni CTA**: "Pozovite me" → `/kontakt` (forma). Uvijek vizuelno podređen (outline/ghost dugme).
- **Tercijarni**: "Pogledajte tour" / "Isprobajte demo" — tekstualni linkovi sa strelicom, koriste se u hero i feature sekcijama.
- Ispod primarnog CTA uvijek microcopy: *"Besplatno do 31.12.2026 · Bez kartice · Postavka za 5 minuta"*.
- Svaka stranica završava **istom završnom CTA sekcijom** (komponenta `FinalCta`): `mist` ili gradijent pozadina, H2, primarni + sekundarni CTA.

---

## 4. Stranice — struktura sekcija i copy

> Copy je draft (W20): BS je primarni, EN prevod. Realizacija smješta stringove u `messages/bs.json` / `messages/en.json` pod namespace `marketing.*`.

### 4.1 Home (`/`)

Redoslijed sekcija:

1. **Hero** (bijela pozadina + gradijent mrlje)
   - Eyebrow badge (pill, `mist` pozadina, `Sparkles` ikonica) — BS: **"Besplatno za sve ordinacije do 31.12.2026"** / EN: "Free for all clinics until Dec 31, 2026"
   - H1 (Fraunces) — BS: **"Vaša ordinacija, konačno organizovana."** / EN: "Your clinic, finally organized."
   - Subtitle — BS: *"DentOrd objedinjuje kartone pacijenata, odontogram, termine, fakture i zalihe — u jednoj jednostavnoj aplikaciji, na bosanskom jeziku."* / EN: *"DentOrd brings patient charts, odontogram, appointments, invoices and inventory together — in one simple app."*
   - CTA red: [Registruj ordinaciju besplatno] [Pogledajte kako radi →] + microcopy.
   - Hero screenshot: **dashboard** u browser okviru (najbogatiji ekran: KPI kartice + današnji termini).

2. **Trust bar** (jedna linija, muted): BS: *"Podaci na EU serverima · GDPR usklađeno · Dnevni backup · Podrška na bosanskom"* — 4 stavke sa Lucide ikonicama (`Server`, `ShieldCheck`, `DatabaseBackup`, `LifeBuoy`).

3. **Problem → rješenje** (`wash` pozadina, 2 kolone)
   - H2 — BS: **"Papirni kartoni i Excel tabele koštaju vas vremena svaki dan."**
   - Lijevo 3–4 bola (ikonica + rečenica): izgubljeni kartoni; dupli termini; ručno pisanje faktura; "ko je šta naplatio?".
   - Desno rješenje — BS: *"DentOrd sve to stavlja na jedno mjesto — dostupno svakom članu tima, prema ulozi, s bilo kojeg uređaja."*

4. **Feature grid** (bijela, 6 kartica, 3×2): Karton + odontogram, Kalendar termina, Fakture i finansije, Email podsjetnici, Dokumenti i saglasnosti, Inventar. Svaka: ikonica-kontejner, H3, 2 rečenice, link "Saznajte više →" na `/funkcije#<anchor>`.

5. **Tour teaser** (`mist`, 2 kolone: tekst + 2–3 preklopljena screenshota)
   - H2 — BS: **"Od registracije do prvog pacijenta za 5 minuta."**
   - 3 koraka mini-lista (1. Registrujte ordinaciju, 2. Dodajte usluge i tim, 3. Zakažite prvi termin) + CTA "Pogledajte cijeli tour →" (`/tour`).

6. **Sigurnost** (jedina `navy` dark sekcija)
   - H2 — BS: **"Podaci pacijenata zaslužuju bankarski nivo sigurnosti."**
   - 4 kartice: EU hosting (D34), Potpuna izolacija klinika (RLS), Kontrola pristupa po ulogama, GDPR (export i brisanje). Ikonice `cyan` na navy.
   - Microcopy dna — BS: *"DentOrd je alat za evidenciju — medicinske odluke uvijek donosi doktor."* (D50)

7. **Pricing teaser** (bijela): H2 — BS: **"Jednostavne cijene. Trenutno — besplatno."** 4 mini kartice (naziv + cijena + 1 rečenica), Professional istaknut, badge "Besplatno do 31.12.2026" preko svih. CTA "Uporedite pakete →" (`/cijene`).

8. **Recenzije** (W10 — komponenta `TestimonialsSection` dizajnirana, renderuje se **samo ako ima sadržaja**; v1 = sakrivena). Dizajn: 3 kartice sa citatom, imenom, nazivom ordinacije, gradom.

9. **FAQ teaser**: 4 najvažnija pitanja (accordion) + link "Sva pitanja →" (`/faq`).

10. **FinalCta** — H2 BS: **"Registrujte ordinaciju danas — besplatno do kraja 2026."** / CTA par + microcopy.

### 4.2 Funkcije (`/funkcije`)

- **Page hero** (kratki): H1 — BS: **"Sve što vašoj ordinaciji treba. Ništa što joj ne treba."** + subtitle + CTA par.
- Zatim **naizmjenične zig-zag sekcije** (screenshot lijevo/desno, tekst suprotno), jedna po modulu, svaka sa anchor ID-em. Redoslijed i sadržaj (iz PRD §6):

| # | Anchor | Modul | Ključni copy fokus |
|---|---|---|---|
| 1 | `#karton` | Pacijenti i karton | Kontakt, historija, alergije, dokumenti, RTG slike; sve na klik |
| 2 | `#odontogram` | Odontogram (FDI) | Vizuelna mapa 11–48; statusi po zubu i površini; historija po zubu |
| 3 | `#plan-terapije` | Plan terapije | Stavke, cijene, statusi; pacijent uvijek zna šta slijedi i koliko košta |
| 4 | `#kalendar` | Kalendar i termini | Dan/sedmica, po doktoru, statusi termina, waitlist auto-popuna |
| 5 | `#finansije` | Fakture i finansije | Fakture u EUR sa PDV-om, uplate, rate, troškovi, Excel izvještaji |
| 6 | `#podsjetnici` | Email podsjetnici i CRM | Automatski podsjetnici na termine; recall pacijenata koji dugo nisu dolazili |
| 7 | `#dokumenti` | Dokumenti i saglasnosti | Saglasnosti sa potpisom na ekranu; PDF arhiva u kartonu |
| 8 | `#inventar` | Inventar | Zalihe materijala, minimalne količine, upozorenja |
| 9 | `#tim` | Tim i uloge | Vlasnik / doktor / recepcija — svako vidi ono što treba (RBAC, D17 postavka za iznose) |
| 10 | `#branding` | Vaš brend | Logo i boje ordinacije na fakturama i emailovima (Pro) |

- Svaka zig-zag sekcija: eyebrow (naziv modula), H2, 2–3 rečenice, 3 bullet-a sa `Check` ikonicom, screenshot tog ekrana.
- Feature dostupnost po paketu naznačiti malim badge-om ("Pro") gdje je relevantno — podaci moraju odgovarati feature matrici (PRD §4.3); **ne hardkodirati odstupanja**.
- Kraj: **FinalCta**.

### 4.3 Cijene (`/cijene`)

1. Page hero: H1 — BS: **"Besplatno do 31.12.2026. Poslije — od 15 € mjesečno."** Subtitle: *"Registrujte se danas i koristite puni Professional paket bez ijedne marke troška do kraja 2026. Bez kartice."*
2. **Pricing grid** — 4 kartice (PRD §4.1, sa PDV-om, EUR):

| Paket | Cijena | Opis (1 linija) |
|---|---|---|
| Starter | 15 €/mj | Za male i solo ordinacije |
| **Professional** (istaknut, badge "Najpopularniji") | 25 €/mj | Sve što prosječnoj ordinaciji treba |
| Premium AI | 35 €/mj | AI asistent i napredna analitika |
| Enterprise | od 60 €/mj | Portal za pacijente, više lokacija, bez limita |

   - Preko svake kartice traka/badge: **"Besplatno do 31.12.2026"**.
   - Svaka kartica: cijena (Fraunces, veliko), "sa PDV-om" microcopy, CTA "Registruj se besplatno" (svi vode na isti `/signup`), lista 5–7 ključnih featura (`Check` ikonice) izvedena iz feature matrice §4.3 PRD-a.
   - Limiti (doktori/korisnici/lokacije/slike) prikazani u karticama iz PRD §4.2.
3. **Napomena o godišnjoj pretplati** (W9, samo tekst): BS: *"Od 2027. godišnja pretplata donosi 2 mjeseca gratis."* (D48)
4. **Poredbena tabela** (collapse na mobile → accordion po paketu): puna feature matrica iz PRD §4.3, ljudski nazivi featura. Fusnota za SMS/WhatsApp i AI (metered, od naplate kanala).
5. **Pricing FAQ** (accordion, 5 pitanja): Šta znači besplatno do 2026? · Treba li kartica? · Šta se dešava 1.1.2027.? · Mogu li mijenjati paket? · Šta ako pređem limit?
6. **FinalCta**.

### 4.4 Zašto DentOrd (`/zasto-dentord`) — W12: bez case studies u v1

1. Page hero: H1 — BS: **"Zašto ordinacije biraju DentOrd?"**
2. **Poređenje "prije / poslije"** (2 kolone ili tabela): papir+Excel vs DentOrd — 6 redova (kartoni, termini, fakture, podsjetnici, izvještaji, tim).
3. **"Napravljen za region"** sekcija: bosanski jezik prvi (D37), EUR + PDV, +387 default (D46), Europe/Sarajevo (D47), podrška na našem jeziku.
4. **Sigurnost i povjerenje** (ista dark sekcija kao Home §6, prošireno: backup D34/§8.3, audit log).
5. **Roadmap/vizija** (kratko, bez obećanja datuma): AI asistent, SMS/WhatsApp podsjetnici, portal za pacijente — "raste s vama".
6. Placeholder blok za **case studies** (komponenta postoji, sakrivena kao recenzije — W10 pattern).
7. **FinalCta**.

### 4.5 Tour (`/tour`) — detaljno u §5

### 4.6 Demo (`/demo`) — W8

1. Page hero: H1 — BS: **"Pogledajte DentOrd iznutra."** Subtitle: *"Isprobajte demo ordinaciju s primjerima pacijenata — bez registracije, bez obaveza."*
2. **Live demo CTA kartica**: dugme "Otvori demo ordinaciju" → prijava u **read-only seed kliniku**:
   - Poseban demo user (role doctor ili owner-readonly) + `clinics.status`/flag koji blokira sva pisanja; server actions vraćaju "Demo mod — izmjene su onemogućene" toast.
   - Trajni banner u appu: *"Ovo je demo ordinacija. Registrujte svoju →"* (link na `/signup`).
   - Seed podaci: 10-ak pacijenata (izmišljena BS imena), popunjen odontogram, termini kroz sedmicu, par faktura, zalihe. **Nikad pravi podaci.**
   - Demo klinika izuzeta iz lifecycle brisanja i analitike konverzija.
3. **Screenshot galerija**: 6–8 ključnih ekrana sa naslovom i opisom (lightbox na klik).
4. **FinalCta** (varijanta: "Svidjelo vam se? Registrujte svoju ordinaciju.").

### 4.7 FAQ (`/faq`)

- Accordion grupisan u 4 kategorije. Pitanja (BS draft; EN prevod 1:1):
  - **Početak**: Kako se registrujem? · Koliko traje postavka? · Mogu li prebaciti postojeće pacijente? (CSV import, D30) · Treba li mi edukacija?
  - **Cijene**: Šta znači "besplatno do 31.12.2026"? · Treba li kreditna kartica? · Šta se dešava kad počne naplata? · Mogu li otkazati bilo kad? (D45 — export + grace)
  - **Sigurnost i podaci**: Gdje se čuvaju podaci? (EU, D34) · Ko sve vidi podatke moje ordinacije? (RLS, samo vaša klinika) · Kako izgleda backup? · Kako brišem podatke pacijenta? (GDPR, D35) · Mogu li izvesti sve svoje podatke? (ZIP export)
  - **Korištenje**: Radi li na mobitelu/tabletu? (D40) · Koliko korisnika mogu dodati? (po paketu) · Mogu li imati dvije lokacije? · Kako pozivam doktora/recepciju? (invite flow)
- Svaki odgovor 2–4 rečenice, bez žargona. Structured data: `FAQPage` JSON-LD.
- **FinalCta**.

### 4.8 Kontakt (`/kontakt`) — W13

1. Page hero: H1 — BS: **"Tu smo za vas."** Subtitle: *"Javite nam se — odgovaramo isti radni dan."*
2. Dvije kartice jedna pored druge:
   - **"Pišite nam"**: `support@dentord.com` (mailto) + `hello@dentord.com` za opšta pitanja (`lib/brand/constants.ts`).
   - **"Pozovite me" forma** (primarna):

| Polje | Tip | Validacija |
|---|---|---|
| Ime i prezime | text | required, min 2 |
| Naziv ordinacije | text | required |
| Telefon | tel | required, default +387 prefiks hint (D46) |
| Email | email | optional ali preporučeno |
| Kada vas nazvati? | select: Prijepodne / Poslijepodne / Svejedno | required |
| Poruka | textarea | optional, max 1000 |
| GDPR checkbox | BS: *"Saglasan/na sam da me DentOrd kontaktira povodom mog upita."* | required |

3. **Backend (W13)**: server action → (a) insert u novu tabelu `public.leads` (`id, created_at, name, clinic_name, phone, email, preferred_time, message, locale, source_page, status`), RLS: **insert preko server-side klijenta, čitanje samo super-admin** (`/platform`, D41 — nema `clinic_id`, platformski podatak); (b) Resend email na `EMAIL_SUPPORT` sa sadržajem; (c) rate limit (IP, npr. 5/h) + honeypot polje protiv spama. Detalje tabele dokumentovati u `docs/DB-OrdinacijaOS.md` pri implementaciji.
4. Success state: inline potvrda — BS: *"Hvala! Nazvat ćemo vas u izabranom terminu."* + sekundarni CTA na tour.
5. **FinalCta** (varijanta: "Ne želite čekati poziv? Registrujte se sami za 5 minuta.").

### 4.9 Blog (`/blog`) — W11: struktura sad, sadržaj kasnije

- v1 realizacija: **ruta i komponente postoje, ali stranica se ne linkuje iz navbara dok nema ≥ 2 članka** (footer link može od starta, uz "uskoro" stanje ili se izostavi).
- Struktura: index (grid kartica: cover, kategorija, naslov, datum, 2 min čitanja) + `/blog/[slug]` (prose layout, TOC za duže članke, autor, related, FinalCta na dnu).
- Tehnika: MDX fajlovi u repou (`content/blog/{bs,en}/`), bez CMS-a u v1.
- Kategorije: Vođenje ordinacije · Digitalizacija · Novosti iz DentOrda.
- SEO: `Article` JSON-LD, OG image po članku.

### 4.10 Pravne stranice (`/privacy`, `/terms`, `/dpa`)

- Sadržaj: iz PRD §13 (outline + draft klauzule) — prose layout, TOC sidebar, datum zadnje izmjene.
- Signup checkbox povezuje Terms + Privacy; DPA prihvaćen kroz Terms (PRD §13.4).
- Bez indeksiranja nije potrebno — ostaju indeksabilne, ali `priority` nizak u sitemapi.

---

## 5. Product tour (`/tour`) — od registracije do svakodnevnog rada

### 5.1 Koncept (W6)

Jedna duga scroll stranica sa **sticky screenshot panelom**: na desktopu lijeva kolona (40%) je tekst koraka koji se scrolla, desna (60%) je sticky browser okvir u kojem se screenshot **crossfade-uje** prema aktivnom koraku (scroll-spy). Na mobile: linearno — tekst koraka pa screenshot, bez sticky ponašanja.

- Anotacije na screenshotima: numerisane tačke (pulsirajući krug `blue`) na ključnim elementima; legenda u tekstu koraka.
- Progress: tanka lijeva vertikalna linija sa tačkama po poglavlju + sticky mini-nav poglavlja na vrhu (scrollspy).
- Svako poglavlje ima "Vrijeme: ~X min" badge da naglasi jednostavnost.

### 5.2 Poglavlja i koraci (usklađeno sa PRD §6.1–6.16)

**Poglavlje 1 — Registracija (2 min)**
1. Klik na "Registruj ordinaciju" — email, lozinka, ime ordinacije, ime vlasnika. Bez kartice.
2. Potvrda emaila i prva prijava. Napomena: vlasnički nalog koristi MFA radi sigurnosti (D11).

**Poglavlje 2 — Postavka ordinacije (5 min, onboarding 3 koraka — D43)**
3. Korak 1: osnovni podaci + radno vrijeme (screenshot onboarding step 1).
4. Korak 2: cjenovnik usluga — ručno ili CSV import (D30).
5. Korak 3: pozivnica timu — doktor/recepcija dobiju email, svako sa svojom ulogom (RBAC).

**Poglavlje 3 — Prvi pacijent (3 min)**
6. Novi pacijent: kontakt, medicinska historija, alergije.
7. Karton: dokumenti i RTG slike na jednom mjestu.
8. Odontogram: klik na zub → status; historija po zubu.
9. Plan terapije: stavke sa cijenama; pacijent zna šta slijedi.

**Poglavlje 4 — Termini (2 min)**
10. Kalendar: dan/sedmica po doktoru; novi termin u 3 klika.
11. Automatski email podsjetnik pacijentu prije termina.
12. Otkazan termin → waitlist automatski predlaže zamjenu.

**Poglavlje 5 — Naplata (3 min)**
13. Iz završenog tretmana → faktura (EUR, PDV, brend ordinacije).
14. Uplate i rate (kalkulator rata).
15. Troškovi + mjesečni izvještaji, izvoz u Excel.

**Poglavlje 6 — Svakodnevni rad (2 min)**
16. Dashboard: današnji termini, novi pacijenti, promet.
17. CRM recall: pacijenti koji dugo nisu dolazili → email u par klikova.
18. Inventar: stanje zaliha i upozorenja na minimum.
19. Postavke, uloge i audit: ko šta vidi i ko je šta mijenjao.

**Završetak**: FinalCta varijanta — BS: **"To je sve. Ozbiljno."** *"Registrujte ordinaciju i prođite ove korake uživo — besplatno do kraja 2026."* + sekundarni link na `/demo`.

### 5.3 Potrebni screenshoti (checklist za produkciju)

Svi iz seed demo klinike, 2× WebP, browser okvir, light tema:

> v1 marketing stranice koriste **CSS UI mockove** u `BrowserFrame` (isti pattern kao Home/Features) dok se ne snime produkcijski WebP-ovi ispod.

- [ ] Signup forma · [ ] Onboarding step 1/2/3 · [ ] Lista pacijenata · [ ] Karton pacijenta · [ ] Odontogram · [ ] Plan terapije · [ ] Kalendar (sedmica) · [ ] Novi termin modal · [ ] Waitlist · [ ] Faktura (pregled/PDF) · [ ] Uplate/rate · [ ] Izvještaji · [ ] Dashboard · [ ] CRM recall · [ ] Inventar · [ ] Settings/tim · [ ] Mobilni prikaz kalendara i kartona (phone okvir, za responsive dokaz)

---

## 6. SEO, analytics, performanse

### 6.1 SEO (W17 — BiH primarno)

- Ključne fraze (BS): *program za stomatološku ordinaciju, softver za zubare, vođenje stomatološke ordinacije, stomatološki karton digitalno, zakazivanje termina stomatolog, dental software Bosna*. EN sekundarno: *dental practice management software*.
- Meta title šablon: `<Stranica> — DentOrd | Softver za stomatološke ordinacije` (≤ 60 znakova). Home: `DentOrd — Softver za vođenje stomatološke ordinacije`.
- `hreflang` bs/en parovi; canonical bez query stringova; sitemap.xml + robots.txt; OG slike 1200×630 (template: navy pozadina, logo, naslov stranice u Fraunces).
- JSON-LD: `SoftwareApplication` (Home, sa pricing offers), `FAQPage` (FAQ), `Article` (blog).
- Blog je dugoročni SEO kanal (W11) — prve teme ciljati na fraze iznad.

### 6.2 Analytics i consent (W18, D33)

- PostHog: eventi `marketing_page_view`, `cta_signup_click` (prop: `source_section`), `cta_contact_click`, `lead_form_submitted`, `demo_opened`, `tour_chapter_viewed` (prop: `chapter`), `faq_opened`.
- **Nikad lična imena/telefoni u analytics** (D33) — lead sadržaj ide samo u DB/email, u PostHog samo činjenica submita.
- Cookie banner (PRD §13.4): essential vs analytics consent; PostHog se učitava **tek nakon pristanka**; banner minimalan (dno, 2 dugmeta + link na Privacy).

### 6.3 Performanse i pristupačnost

- Ciljevi: Lighthouse ≥ 95 performance/SEO/a11y na Home; LCP < 2 s (hero screenshot = `priority` image, tačne dimenzije); CLS ≈ 0.
- Sve slike `next/image`, WebP, lazy osim hero. Fontovi već self-hosted preko `next/font`.
- Statika: sve marketing stranice statički renderovane (SSG/ISR), bez klijentskog fetchanja osim forme.
- A11y: kontrast AA (provjeriti `blue` na `wash`), fokus prstenovi, semantički headinzi (jedan H1 po stranici), `prefers-reduced-motion` (§2.5), alt tekstovi na svim screenshotima.

---

## 7. Redoslijed realizacije i acceptance checklist

### 7.1 Faze

1. **Temelj**: `(marketing)` route group, marketing layout (navbar/footer/FinalCta/SectionShell komponente), i18n namespace `marketing.*`, SEO helper (metadata, OG, JSON-LD), cookie consent + PostHog gate. ✅ (1a shell, 1b pathnames+stubs, 1c SEO+consent)
2. **Core stranice**: Home → Cijene → Funkcije → FAQ → Kontakt (+ `leads` tabela i Resend akcija). ✅ Home · Cijene · Funkcije · FAQ · Kontakt
3. **Tour + Demo**: seed demo klinika + read-only mehanizam, screenshot produkcija (§5.3), tour stranica, demo stranica. ✅ Tour · Demo UI · `is_demo` + seed script · CSS mock previewi (WebP §5.3 checklist ostaje za produkciju screenshota)
4. **Ostalo**: Zašto DentOrd, pravne stranice (iz PRD §13), blog skeleton (nelinkovan), OG image template, sitemap/robots. ✅ Zašto DentOrd · Privacy/Terms/DPA · blog MDX skeleton (nav ≥2) · `/api/og` · sitemap/robots

### 7.2 Acceptance checklist

- [ ] Sve rute iz §3.1 postoje na BS i EN; language switcher čuva trenutnu stranicu
- [ ] Primarni CTA na svakoj stranici vodi direktno na `/signup` (ne na demo/kontakt)
- [ ] Pricing prikazuje 4 paketa sa PDV-om + "Besplatno do 31.12.2026" badge; podaci se slažu sa PRD §4.1–4.3
- [x] Kontakt forma: zapis u `leads` + email na support@ + rate limit + honeypot; čitanje leads samo super-admin
- [x] Recenzije i case studies sekcije postoje kao komponente ali su sakrivene (nema sadržaja)
- [x] Zašto DentOrd: prije/poslije, region, sigurnost (+backup/audit), roadmap; case studies sakrivene (W12)
- [x] Pravne stranice Privacy/Terms/DPA iz PRD §13 (draft + TOC + datum izmjene)
- [x] Blog skeleton: `content/blog/{bs,en}/` MDX, index + `[slug]`; navbar tek uz ≥2 članka
- [x] OG image template (`/api/og`) + `sitemap.ts` / `robots.ts`
- [x] Tour: svih 6 poglavlja, scroll-spy, crossfade screenshoti, radi linearno na mobile
- [x] Demo klinika: read-only, banner sa CTA, izmišljeni podaci (seed script; live login via `DEMO_CLINIC_*` env)
- [x] Cookie banner blokira PostHog do pristanka; nijedan event ne sadrži lične podatke
- [ ] `prefers-reduced-motion` gasi animacije; nema CLS-a od animacija
- [ ] Lighthouse ≥ 95 (perf/SEO/a11y) na Home i Cijene; full responsive (D40)
- [ ] Footer na svim stranicama ima Privacy/Terms/DPA linkove (PRD §13.4)
- [ ] Nijedna boja van §2.1 palete; samo Lucide ikonice; samo light tema
