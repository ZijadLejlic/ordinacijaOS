# Sentry — DentOrd

> Medical/dental SaaS: **no patient PHI** in Sentry (D33).  
> Verified live on production (2026-07-29). Temporary test routes removed.

## What is wired

| Surface | Mechanism |
|---|---|
| Client / React | `instrumentation-client.ts` + `app/global-error.tsx` |
| Server / RSC / request errors | `instrumentation.ts` → `sentry.server.config.ts` + `onRequestError` |
| Edge / middleware | `sentry.edge.config.ts` |
| Source maps + release | `next.config.ts` → `withSentryConfig` |
| Auth context | `setSentryAuthContext` / `clearSentryAuthContext` |
| Manual capture | `captureUnexpectedError({ feature, operation })` |
| Server Actions (opt-in) | `withObservedServerAction` in `lib/observability/sentry-server.ts` |

SDK: `@sentry/nextjs` (Next.js 16). Environments: `development` | `preview` | `production`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel **Production + Preview** | Public DSN; without it SDK is disabled |
| `SENTRY_AUTH_TOKEN` | Vercel **Production + Preview** (**Build**) | Source map + release upload. **Never** `NEXT_PUBLIC_` |
| `SENTRY_ORG` | Build | Org slug (`ordinacijaos-47`) |
| `SENTRY_PROJECT` | Build | Project slug (`javascript-nextjs`) |
| `SENTRY_RELEASE` | Optional | Defaults to `VERCEL_GIT_COMMIT_SHA` |
| `SENTRY_ENABLE_DEV` / `NEXT_PUBLIC_SENTRY_ENABLE_DEV` | Local only | `1` to send events from `next dev` |

`NEXT_PUBLIC_SENTRY_ENVIRONMENT` is embedded at build from `VERCEL_ENV`.

## Privacy (must stay true)

- `sendDefaultPii: false`
- User context = `id` only
- Tags: `clinic_id`, `role`, `feature`, `operation` — never patient names
- No cookies, Authorization, Supabase tokens, or request/form bodies
- Session Replay: `maskAllText` + `blockAllMedia`
- Expected business errors (credentials, validation, overlap, 401/403) not reported
- Stale Server Action after deploy (`Failed to find Server Action`) dropped as deploy skew

## Sampling

| Signal | Rate |
|---|---|
| Traces (preview/production) | `0.1` |
| Replay sessions | `0.01` |
| Replay on error | `1.0` |

## Local smoke (optional)

```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=…
NEXT_PUBLIC_SENTRY_ENABLE_DEV=1
SENTRY_ENABLE_DEV=1
```

Throw any unexpected error in the clinic app and check Sentry Issues.
