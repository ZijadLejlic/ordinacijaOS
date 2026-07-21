# UAT / partner testiranje — DentOrd

> Free period do **31.12.2026** (Professional entitlements, bez naplate).  
> Live: [https://www.dentord.com](https://www.dentord.com)  
> Bugovi / pitanja: **support@dentord.com**  
> Ops: `docs/Production-Ops.md` · PRD UAT: §12.3–12.5

---

## 1. Prije poziva partnera (ti)

### 1.1 Brzi ops check

```bash
npm run check:production-ops
```

- [x] MX `support@` (ImprovMX) — aktivno 2026-07-21  
- [ ] Vercel: `NEXT_PUBLIC_APP_URL=https://www.dentord.com` + redeploy (invite linkovi)  
- [ ] Deploy mobilnih fixeva (prioritet 2) na produkciju  
- [ ] Test invite sa drugog maila → link na `www.dentord.com`, ne localhost  

### 1.2 Interni smoke (owner nalog na produkciji)

Radi redom; označi. Cilj: &lt; 30 min (KPI time-to-first-appointment).

| # | Korak | OK? |
|---|---|---|
| 1 | Signup / login owner + MFA | ☐ |
| 2 | Onboarding (klinika, usluge, invite korak) | ☐ |
| 3 | Invite **doktor** + **recepcija** → postave lozinku, uđu s ispravnom rolom | ☐ |
| 4 | (Opcionalno) PIN operator na reception | ☐ |
| 5 | Novi pacijent + alergija | ☐ |
| 6 | Karton: dokument/slika upload, odontogram klik, plan terapije stavka | ☐ |
| 7 | Kalendar: termin (default trajanje), overlap blokiran, email podsjetnik test | ☐ |
| 8 | Faktura: linije + izdavanje + PDF download + partial uplata | ☐ |
| 9 | Dashboard KPI danas vidljiv | ☐ |
| 10 | Mobile (~375px): login, kalendar dan, karton, lista faktura | ☐ |
| 11 | Kontakt forma / mail na `support@` stiže | ☐ |

Moduli bez punog E2E (ručno ako treba): CRM, inventar, consent sign, CSV import, ZIP backup, GDPR erasure (samo na test pacijentu).

---

## 2. Šta reći partneru (kratka poruka)

Možeš kopirati:

```text
Pozivamo vas da testirate DentOrd — softver za stomatološku ordinaciju.
Besplatno do 31.12.2026 (Professional paket, bez kartice).

Registracija: https://www.dentord.com/bs/signup
(ili vas owner pozove emailom kao doktora / recepciju)

Šta nam treba (7–14 dana, paralelno uz vaš postojeći rad):
• owner: signup + onboarding
• 1 doktor + 1 recepcija: login, termini, karton
• feedback: što smeta, što fali

Bugovi i pitanja: support@dentord.com
Ne unosite stvarne pacijente ako niste spremni — možete koristiti izmišljene podatke.
```

### Uloge (PRD §12.3)

| Uloga | Šta testira |
|---|---|
| Owner | Signup, tim, usluge, fakture, postavke |
| Doktor | Karton, odontogram, plan, svoj kalendar |
| Recepcija | Termini, waitlist, CRM email, PIN switch |

Demo klinika (read-only marketing): `/bs/demo` — odvojena od pravih tenanata.

---

## 3. Partner smoke (minimalno)

Za svaku partner ordinaciju:

- [ ] Owner završio onboarding  
- [ ] Doktor ulogovan, kreirao bar 1 termin  
- [ ] Recepcija ulogovana, bar 1 pacijent + 1 termin  
- [ ] Bar 1 faktura PDF (owner/accountant)  
- [ ] Feedback mail na support@ (ili “sve OK”)  

---

## 4. Kako prijaviti bug

Na **support@dentord.com**, u subjectu: `[UAT] kratki opis`

U bodyju:
1. Ordinacija / uloga (owner / doktor / recepcija)  
2. URL stranice  
3. Koraci (1–2–3)  
4. Očekivano vs stvarno  
5. Desktop ili mobilni (+ browser)  
6. Screenshot ako ima  

**Ne šalji** imena pravih pacijenata u javne kanale; za analytics vrijedi D33 (bez PII).

---

## 5. Nakon prvog feedbacka

1. Triage: blocker / UX / kasnije  
2. Fix → deploy → kratki reply partneru  
3. Poslije ~10 dana: traži dozvolu za recenziju (Website W10 — testimonials trenutno sakrivene)
