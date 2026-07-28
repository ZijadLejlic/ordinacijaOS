# Sentry — DentOrd (temporary verification + ops)

> Medical/dental SaaS: **no patient PHI** in Sentry (D33).  
> After verification, **delete** the temporary test page + API (marked below).

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

SDK: `@sentry/nextjs` (compatible with Next.js 16). Environments: `development` | `preview` | `production`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel **Production + Preview** (+ local if testing) | Public DSN; without it SDK is disabled |
| `SENTRY_AUTH_TOKEN` | Vercel **Production + Preview** (**Build** only) | Source map + release upload. **Never** `NEXT_PUBLIC_` |
| `SENTRY_ORG` | Build (optional if default in config) | Sentry org slug |
| `SENTRY_PROJECT` | Build (optional if default in config) | Sentry project slug |
| `SENTRY_RELEASE` | Optional override | Defaults to `VERCEL_GIT_COMMIT_SHA` |
| `SENTRY_ENABLE_DEV` / `NEXT_PUBLIC_SENTRY_ENABLE_DEV` | Local only | Set to `1` to send events from `next dev` |
| `SENTRY_ENABLE_TEST_ENDPOINTS` | Temporary on Preview/Production | Set to `1` to unlock test routes in production builds |
| `NEXT_PUBLIC_SENTRY_DEBUG` | Optional local | `1` for SDK debug logs when dev capture is on |

`NEXT_PUBLIC_SENTRY_ENVIRONMENT` is **embedded at build** from `VERCEL_ENV` via `next.config.ts` (do not set manually unless you intentionally override).

### Vercel checklist

1. Production + Preview: `NEXT_PUBLIC_SENTRY_DSN`
2. Production + Preview (Build): `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
3. Confirm `SENTRY_AUTH_TOKEN` is **not** exposed to the browser / Edge Runtime unless needed — Build is enough for uploads
4. Optional: install [Sentry ↔ Vercel integration](https://docs.sentry.io/organization/integrations/deployment/vercel/) for auto env + deploy notifications
5. Redeploy after setting build secrets so source maps upload

### Local development

By default **no events** are sent in development. To verify locally:

```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=…
NEXT_PUBLIC_SENTRY_ENABLE_DEV=1
SENTRY_ENABLE_DEV=1
```

## Privacy checklist (must stay true)

- [ ] `sendDefaultPii: false`
- [ ] User context = `id` only (no email / display name)
- [ ] Tags: `clinic_id`, `role`, `feature`, `operation` — never patient names
- [ ] No cookies, `Authorization`, Supabase tokens, or request/form bodies
- [ ] Session Replay: `maskAllText: true`, `blockAllMedia: true`
- [ ] Expected business errors (credentials, validation, overlap, 401/403) not reported
- [ ] `captureUnexpectedError` never called with form payloads

## Temporary test endpoints — REMOVE AFTER VERIFICATION

| Endpoint | Role |
|---|---|
| `GET /api/sentry-test` | Server message + tags |
| `GET /api/sentry-test?mode=error` | Server throw (source maps / trace) |
| `/{locale}/sentry-test` | Client capture / throw + Replay |

Files to delete:

- `app/api/sentry-test/route.ts`
- `app/[locale]/(marketing)/sentry-test/page.tsx`
- `components/observability/sentry-client-test-panel.tsx`
- This section of the doc

Unlock on production temporarily:

```text
SENTRY_ENABLE_TEST_ENDPOINTS=1
```

Then remove the env var and the files above.

## Exact verification steps

1. Deploy Preview (or Production with test flag).
2. **Server:** `curl -s "https://<host>/api/sentry-test"` → note `eventId`, `environment`, `release`.
3. In Sentry Issue, confirm:
   - Environment = `preview` or `production`
   - Release ≈ git commit SHA
   - User = `sentry-test-user` (id only)
   - Tags `clinic_id`, `role`, `feature`
   - Breadcrumb `server sentry-test breadcrumb`
   - Trace linked (Performance)
4. **Source maps:** `curl "https://<host>/api/sentry-test?mode=error"` (expect 500). Stack frame should show `app/api/sentry-test/route.ts` (or TS path), not only minified bundle.
5. **Client / Replay:** open `https://<host>/bs/sentry-test` → “Capture client error” (and optionally Throw). In Sentry: breadcrumbs + **Replay** attached (error sample rate 100%).
6. Confirm production env label on a Production deploy event.
7. Remove test endpoints + `SENTRY_ENABLE_TEST_ENDPOINTS`.

## Sampling

| Signal | Rate |
|---|---|
| Traces (preview/production) | `0.1` |
| Replay sessions | `0.01` |
| Replay on error | `1.0` |

## Remaining / manual

- Create/confirm Sentry project + auth token with `project:releases` + org read scopes
- Connect GitHub in Sentry for commit/suspect commits (helps with `setCommits.auto`)
- After verification, delete temporary endpoints
- Optionally wrap critical Server Actions with `withObservedServerAction` (not required for uncaught errors — `onRequestError` covers many cases)
