/**
 * Shared Sentry environment helpers (client + server + edge safe).
 *
 * Environments: development | preview | production
 * Local events are off unless explicitly enabled.
 */

export type SentryDeployEnvironment =
  | "development"
  | "preview"
  | "production";

export function getSentryDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return dsn && dsn.length > 0 ? dsn : undefined;
}

/**
 * Prefer build-time embed (`NEXT_PUBLIC_SENTRY_ENVIRONMENT` from next.config),
 * then Vercel runtime `VERCEL_ENV`, then NODE_ENV.
 */
export function getSentryEnvironment(): SentryDeployEnvironment {
  const explicit =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV;

  if (explicit === "production" || explicit === "preview") {
    return explicit;
  }
  if (explicit === "development") {
    return "development";
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  return "development";
}

/** Local / `next dev` — require explicit opt-in before sending events. */
export function isSentryDevCaptureEnabled(): boolean {
  return (
    process.env.SENTRY_ENABLE_DEV === "1" ||
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === "1"
  );
}

export function isSentryEnabled(): boolean {
  if (!getSentryDsn()) return false;
  if (getSentryEnvironment() === "development") {
    return isSentryDevCaptureEnabled();
  }
  return true;
}

/** Conservative tracing in preview/production; full when local is opted-in. */
export function getSentryTracesSampleRate(): number {
  const env = getSentryEnvironment();
  if (env === "development") return 1.0;
  if (env === "preview") return 0.1;
  return 0.1;
}

/**
 * Temporary verification endpoints (API + page).
 * REMOVE after Sentry verification — see docs/Sentry.md.
 */
export function areSentryTestEndpointsEnabled(): boolean {
  if (process.env.SENTRY_ENABLE_TEST_ENDPOINTS === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/** Vercel / CI commit SHA for release correlation (also used by withSentryConfig). */
export function getSentryRelease(): string | undefined {
  return (
    process.env.SENTRY_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    undefined
  );
}
