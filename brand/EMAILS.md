# DentOrd email (dentord.com + Resend)

Resend je **send** provider. Domen mora biti Verified (SPF + DKIM).

| Adresa | Uloga |
|--------|--------|
| `noreply@dentord.com` | Transactional From (invite, reset, podsjetnici) — `EMAIL_FROM` |
| `support@dentord.com` | Reply-To + support inbox (D44) — `EMAIL_REPLY_TO` / default |
| `hello@dentord.com` | Marketing / sales (kasnije) |

App koristi konstante u `lib/brand/constants.ts`. Ops checklist: `docs/Production-Ops.md`.

## Slanje (Resend) — status

DNS (provjereno 2026-07-21):

- DKIM: `resend._domainkey.dentord.com` TXT ✅
- SPF: `send.dentord.com` TXT (`v=spf1 …`) ✅

U Vercel: `RESEND_API_KEY` + `EMAIL_FROM=DentOrd <noreply@dentord.com>` (produkcija baca grešku ako nedostaju).

## Primanje (`support@` / `hello@`)

Resend **ne prima** mail. Treba MX + mailbox / forwarder.

**Preporuka za UAT:** ImprovMX → forward na lični Gmail.

GoDaddy DNS:

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |
| TXT | `@` | `v=spf1 include:spf.improvmx.com include:amazonses.com ~all` | — |

Zatim u ImprovMX: alias `support` (i `hello`) → tvoj inbox.

Provjera: `dig MX dentord.com` + test poruka na `support@dentord.com`.
