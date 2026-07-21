# Production ops — prije partner UAT

> Checklist za **prioritet 1**: produkcija, email, cron, Supabase toggles.
> Ažurirano: **2026-07-21**. Live host: `https://www.dentord.com` (Vercel, apex `dentord.com` → 308 na www).

---

## Trenutni status (provjereno)

| Stavka | Status | Dokaz / napomena |
|---|---|---|
| Marketing + app na Vercel | ✅ | `GET /bs` → 200; `/bs/login`, `/bs/signup` → 200 |
| Cron route + `CRON_SECRET` | ✅ | `GET /api/cron/clinic-lifecycle` → **401** (secret postoji; nije 500 “not configured”) |
| Vercel Cron schedule | ✅ u kodu | `vercel.json` → `0 3 * * *` → `/api/cron/clinic-lifecycle` |
| Resend send (SPF + DKIM) | ✅ DNS | `send.dentord.com` SPF; `resend._domainkey.dentord.com` DKIM |
| **MX / inbox `support@`** | ❌ | Nema MX na `dentord.com` — mailovi na support@ **ne stižu** |
| Leaked Password Protection | ⏭️ Free | Auth feature često **Pro+**; na Free skip za UAT (advisor WARN ostaje) |
| JWT Custom Access Token hook | ⏭️ Free | Auth Hooks = **Pro+**; funkcija u DB postoji, helperi rade preko `profiles` fallbacka — OK za UAT |
| `NEXT_PUBLIC_APP_URL` na Vercel | ⚠️ ručno | Mora biti `https://www.dentord.com` (ili `https://dentord.com`) — invite/reset linkovi |

---

## 1. Šta moraš uraditi ručno (danas)

### 1.1 Inbox za `support@` / `hello@` (MX) — blocker za UAT

Resend **šalje**; ne prima. Bez MX partneri ne mogu javiti bugove na `support@dentord.com`.

**Najbrže (besplatno):** [ImprovMX](https://improvmx.com) forward → tvoj Gmail.

U GoDaddy DNS (NS: `domaincontrol.com`) dodaj:

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |
| TXT | `@` | `v=spf1 include:spf.improvmx.com include:amazonses.com ~all` | — |

> Ako već imaš Resend SPF na `send.` subdomainu, root TXT za ImprovMX neće pokvariti DKIM na `resend._domainkey`. Ako GoDaddy već ima root SPF, spoji `include:` u jedan TXT zapis (jedan SPF po domenu).

U ImprovMX: alias `support` → tvoj email; opcionalno `hello`.

**Provjera:** `dig MX dentord.com` mora vratiti zapise; pošalji test na `support@dentord.com`.

### 1.2 Supabase — Leaked Password Protection (B1)

**Free plan:** često nedostupno (Pro+). Za partner UAT **preskoči** — nije blocker.

Kad budeš na Pro: Authentication → Attack Protection / Providers → **Leaked password protection** ON.

### 1.3 Supabase — Custom Access Token hook (B5)

**Free plan:** Auth Hooks su Pro+. Funkcija je u DB, ali se ne može enable-ati na Free.

Za UAT **preskoči** — `current_clinic_id()` / `current_app_role()` i dalje rade preko `profiles` fallbacka (vidi `docs/DB-OrdinacijaOS.md` §2).

Kad budeš na Pro: Authentication → Hooks → Custom Access Token → `public.custom_access_token_hook`.

Docs: [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

### 1.4 Vercel env (Production)

U Vercel → Project → Settings → Environment Variables, potvrdi:

| Key | Produkcijska vrijednost |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pcfroikqbjvwweeidgar.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | (service_role — server only) |
| `NEXT_PUBLIC_APP_URL` | `https://www.dentord.com` |
| `RESEND_API_KEY` | (Resend) |
| `EMAIL_FROM` | `DentOrd <noreply@dentord.com>` |
| `CRON_SECRET` | isti kao lokalni / jak random |
| `DEMO_CLINIC_EMAIL` / `DEMO_CLINIC_PASSWORD` | ako želite live `/demo` |
| `NEXT_PUBLIC_SENTRY_DSN` | opcionalno |
| `NEXT_PUBLIC_POSTHOG_KEY` | opcionalno |

Nakon izmjene `NEXT_PUBLIC_*` → **Redeploy**.

**Smoke invite:** owner pozove sebe na drugi email → link u mailu mora biti `https://www.dentord.com/...` (ne `localhost`).

---

## 2. Automatska lokalna provjera

```bash
npm run check:production-ops
```

Provjerava DNS (MX, SPF, DKIM) i HTTP (home, login, signup, cron 401).

Detaljni env booleani (bez curenja secret vrijednosti), nakon deploya health rute:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.dentord.com/api/health
```

---

## 3. Acceptance — prioritet 1 gotov kad

- [ ] `dig MX dentord.com` vraća ImprovMX (ili Workspace) MX
- [ ] Test mail na `support@dentord.com` stiže u inbox
- [ ] Leaked password protection ON (advisor čist)
- [ ] Custom Access Token hook Enabled u Auth → Hooks
- [ ] Invite email link koristi `https://www.dentord.com`
- [ ] Cron i dalje 401 bez secret-a; Vercel Cron log pokazuje uspješan run (ili ručni `Authorization: Bearer …`)

Kad ovo prođe → prioritet 2 (mobile responsive smoke).
