# DentOrd email (dentord.com + Resend)

Resend je **send** provider. Domen mora biti Verified (SPF + DKIM).

| Adresa | Uloga |
|--------|--------|
| `noreply@dentord.com` | Transactional From (invite, reset, podsjetnici) — `EMAIL_FROM` |
| `support@dentord.com` | Reply-To + support inbox (D44) — `EMAIL_REPLY_TO` / default |
| `hello@dentord.com` | Marketing / sales (kasnije) |

**Primanje** maila na `support@` / `hello@` nije Resend — treba MX kod mailbox providera (Google Workspace, Zoho, ImprovMX, …).

App koristi konstante u `lib/brand/constants.ts`.
