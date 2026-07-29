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
| JWT Custom Access Token hook | ⏭️ Free / ✅ local CI | Pro+ enable in dashboard; `profiles` fallback OK za UAT (D-04 ACCEPTED). Local `config.toml` hook **on** for security suite. |
| Auth session TTL (D12) | ✅ local / ⚠️ hosted mirror | Local `config.toml`: `jwt_expiry = 604800`, `[auth.sessions] timebox = "168h"`. Hosted: Authentication → Settings → JWT expiry **604800**, Sessions timebox **168h**. Asserted by `AUTH-INT-021`. |
| `NEXT_PUBLIC_APP_URL` na Vercel | ✅ | `https://www.dentord.com` — health 2026-07-28: `appUrl` + `appUrlLooksProduction` |
| Supabase Auth **Site URL** | ✅ | `https://www.dentord.com` + Redirect URLs (`/**` + localhost) — set 2026-07-29. Dashboard: [URL Configuration](https://supabase.com/dashboard/project/pcfroikqbjvwweeidgar/auth/url-configuration) |
| Mobile responsive (D40) | ✅ | U kodu + na produkciji (`a4dbe9f` / PR #1) |

---

## 1. Preostalo ručno (kratko)

### 1.1 Vercel env + redeploy

Potvrdi Production env:

| Key | Vrijednost |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.dentord.com` |
| `EMAIL_FROM` | `DentOrd <noreply@dentord.com>` |
| `RESEND_API_KEY` / `CRON_SECRET` / Supabase keys | set |
| Sentry (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` Build-only, org/project) | vidi `docs/Sentry.md` |

Redeploy da uđu: `/api/health`, mobile fixovi, ostale lokalne izmjene.

**Smoke invite:** link u mailu = `https://www.dentord.com/...` (ne localhost).

### 1.1b Supabase Auth URL Configuration (signup confirm)

Signup confirmation emails use GoTrue **Site URL** when `emailRedirectTo` is missing or not allow-listed. Hosted auth logs still showed `referer: http://localhost:3000` (2026-07-29) → Site URL was never flipped for production.

U [URL Configuration](https://supabase.com/dashboard/project/pcfroikqbjvwweeidgar/auth/url-configuration):

| Polje | Vrijednost |
|---|---|
| **Site URL** | `https://www.dentord.com` |
| **Redirect URLs** | `https://www.dentord.com/**`, `http://localhost:3000/**`, `http://127.0.0.1:3000/**` |

App šalje `emailRedirectTo` → `https://www.dentord.com/auth/callback?next=/bs/login` (PKCE exchange u `app/auth/callback`).

**Smoke signup:** novi nalog → confirm link u mailu = `www.dentord.com` (ne localhost) → login/MFA/onboarding.

### 1.2 Supabase Free — skip

Leaked password + Auth Hooks = Pro+. Nije UAT blocker.

**Hosted Auth session TTL (D12):** mirror local `supabase/config.toml` — JWT expiry **604800** s (7d) and Sessions timebox **168h**. Automated assert: `AUTH-INT-021` (`lib/security/session-ttl-config.test.ts`).

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
- [x] `NEXT_PUBLIC_APP_URL` Production (`appUrlLooksProduction` 2026-07-28)
- [x] Invite smoke: link u mailu = `www.dentord.com` (ne localhost) — verified 2026-07-28
- [ ] Signup confirm smoke: link u mailu = `www.dentord.com` (ne localhost) — Site URL set; verify after deploy callback
- [x] Redeploy (health + mobile) — PR #1 / `a4dbe9f`
- [x] Supabase Pro toggles — N/A na Free

Dalje: **`docs/UAT-Partner.md`** (interni smoke → poziv partnera).
