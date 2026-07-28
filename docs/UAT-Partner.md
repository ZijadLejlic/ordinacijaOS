# UAT / partner testiranje — DentOrd

> Free period do **31.12.2026** (Professional entitlements, bez naplate).  
> Live: [https://www.dentord.com](https://www.dentord.com)  
> Bugovi / pitanja: **support@dentord.com**  
> Ops: `docs/Production-Ops.md` · PRD UAT: §12.3–12.5  
> QA: [Traceability-Matrix.md](./QA/Traceability-Matrix.md) · [Test-Strategy.md](./QA/Test-Strategy.md)

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

**Autom. vs ručno:** `Auto` = CI/Playwright/Vitest već pokriva happy-path (ne zamjenjuje produkcijski smoke). `Ručno` = nema E2E ili samo INT/parcijalno — fokus UAT-a.

| # | Korak | Auto? | Test IDs / napomena | OK? |
|---|---|---|---|---|
| 1 | Signup / login owner + MFA | Auto | `AUTH-E2E-001`, `AUTH-E2E-003` — na prod ipak uradi jednom | ☐ |
| 2 | Onboarding (klinika, usluge, invite korak) | Auto | `AUTH-E2E-001` (steps 1–3; invite skip u E2E) | ☐ |
| 3 | Invite **doktor** + **recepcija** → lozinka + uloga | Auto | `AUTH-E2E-002` — na prod provjeri invite URL ≠ localhost | ☐ |
| 4 | (Opcionalno) PIN operator na reception | Ručno | `AUTH-INT-011` PARTIAL; cross-clinic PIN = `AUTH-SEC-002` | ☐ |
| 5 | Novi pacijent + alergija | Ručno | Tenant isolation Auto (`TEN-E2E-001` / TEN-RLS); alergija UI nema E2E | ☐ |
| 6 | Karton: dokument/slika, odontogram, plan terapije | Djelomično | FDI/plan/consent INT: `PII-INT-010..012`; upload UI + alergije = ručno | ☐ |
| 7 | Kalendar: termin, overlap, email podsjetnik | Djelomično | Overlap Auto `CAL-E2E-001`; waitlist INT `CAL-INT-003`; reminder INT `CRM-INT-001`; default trajanje GAP | ☐ |
| 8 | Faktura: izdavanje + PDF + partial uplata | Djelomično | PDF Auto `FIN-E2E-001`; partial/void INT `FIN-INT-003/004`; installments GAP | ☐ |
| 9 | Dashboard KPI danas vidljiv | Auto (INT) | `FIN-INT-020`, `RBAC-INT-010` — prod smoke i dalje | ☐ |
| 10 | Mobile (~375px): login, kalendar, karton, fakture | Ručno | `CAL-E2E-002` / `MKT-E2E-003` GAP — prioritet partner UAT | ☐ |
| 11 | Kontakt forma / mail na `support@` stiže | Ručno | `CRM-INT-003` GAP; lead honeypot/rate Auto `MKT-INT-001`/`MKT-SEC-002` | ☐ |

### 1.3 Moduli — Auto INT vs ručni UAT

Ovi moduli imaju **INT/unit** pokrivenost, ali **nema** Playwright journey na produkciji. Ručno smoke (test podaci only):

| Modul | Auto (INT/unit) | Ručni UAT fokus |
|---|---|---|
| CRM light (birthday/recall) | `CRM-INT-002`, `CRM-UNIT-002` | Generate lista + human send iz UI |
| Inventar | `PLAN-INT-021`, `RBAC-INT-021` | Low-stock badge; create/adjust |
| Consent draw-sign | `PII-INT-012` | Potpis na uređaju → PDF u kartonu |
| CSV import | `IMP-INT-001`, `IMP-UNIT-001` | Preview greške → commit patients/services |
| Branding boje | `PLAN-INT-022` | Shell boje; logo upload ACL COVERED (`FILE-INT-011`) |
| ZIP backup / GDPR erasure | `PII-API-002`, `PII-INT-001` | Owner-only; **samo test pacijent / demo klinika** |
| Shared pricelist / lokacije | — (`PLAN-INT-020` GAP) | Toggle shared pricelist ručno |
| Installments | — (`FIN-INT-010` GAP) | Ako Pro: payment plan UI |

Marketing public smoke (bez logina) je Auto: `e2e/marketing-smoke.spec.ts` → `MKT-E2E-001/002/004`.

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

| # | Korak | Vezano na interni # / Auto | OK? |
|---|---|---|---|
| 1 | Owner završio onboarding | #1–2 · Auto `AUTH-E2E-001` | ☐ |
| 2 | Doktor ulogovan, kreirao bar 1 termin | #3 + #7 · Auto overlap `CAL-E2E-001` | ☐ |
| 3 | Recepcija ulogovana, bar 1 pacijent + 1 termin | #3 + #5 · tenant Auto `TEN-E2E-001` | ☐ |
| 4 | Bar 1 faktura PDF (owner/accountant) | #8 · Auto `FIN-E2E-001` | ☐ |
| 5 | Feedback mail na support@ (ili “sve OK”) | #11 · ručno | ☐ |

Prioritet partner feedbacka koji Auto **ne** hvata: **mobile (#10)**, PIN desk, alergije/upload UI, installments, shared pricelist, logo branding.

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

---

*UAT partner checklist — cross-linked to QA Traceability/Test-Strategy 2026-07-28 (P5.9).*
