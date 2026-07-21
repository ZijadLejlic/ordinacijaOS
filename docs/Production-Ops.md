# Production ops — prije partner UAT

> Checklist za **prioritet 1**: produkcija, email, cron, Supabase toggles.
> Ažurirano: **2026-07-21**. Live host: `https://www.dentord.com` (Vercel, apex `dentord.com` → 308 na www).
> Partner UAT: **`docs/UAT-Partner.md`**.

---

## Trenutni status (provjereno)

| Stavka | Status | Dokaz / napomena |
|---|---|---|
| Marketing + app na Vercel | ✅ | `GET /bs` → 200; `/bs/login`, `/bs/signup` → 200 |
| Cron route + `CRON_SECRET` | ✅ | `GET /api/cron/clinic-lifecycle` → **401** |
| Vercel Cron schedule | ✅ u kodu | `vercel.json` → `0 3 * * *` |
| Resend send (SPF + DKIM) | ✅ DNS | `send.dentord.com` SPF; `resend._domainkey` DKIM |
| MX / inbox `support@` | ✅ | ImprovMX `mx1`/`mx2` + root SPF; aliases `support` + `hello` → Gmail |
| Leaked Password Protection | ⏭️ Free | Pro+; skip za UAT |
| JWT Custom Access Token hook | ⏭️ Free | Pro+; `profiles` fallback OK za UAT |
| `NEXT_PUBLIC_APP_URL` na Vercel | ⚠️ ručno | Mora biti `https://www.dentord.com` — invite linkovi |
| Mobile responsive (D40) | ✅ u kodu | Deploy potreban na produkciju |

---

## 1. Preostalo ručno (kratko)

### 1.1 Vercel env + redeploy

Potvrdi Production env:

| Key | Vrijednost |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.dentord.com` |
| `EMAIL_FROM` | `DentOrd <noreply@dentord.com>` |
| `RESEND_API_KEY` / `CRON_SECRET` / Supabase keys | set |

Redeploy da uđu: `/api/health`, mobile fixovi, ostale lokalne izmjene.

**Smoke invite:** link u mailu = `https://www.dentord.com/...` (ne localhost).

### 1.2 Supabase Free — skip

Leaked password + Auth Hooks = Pro+. Nije UAT blocker.

### 1.3 MX (gotovo)

ImprovMX active. Self-test sa istog Gmaila može ići u Spam (očekivano); testiraj s **druge** adrese.

---

## 2. Automatska lokalna provjera

```bash
npm run check:production-ops
```

Detaljni env (nakon deploya health rute):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.dentord.com/api/health
```

---

## 3. Acceptance — prioritet 1

- [x] MX ImprovMX
- [x] Cron 401 bez secret-a
- [x] Resend SPF/DKIM
- [ ] `NEXT_PUBLIC_APP_URL` + invite link na www
- [ ] Redeploy (health + mobile)
- [x] Supabase Pro toggles — N/A na Free

Dalje: **`docs/UAT-Partner.md`** (interni smoke → poziv partnera).
