import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryRelease,
  getSentryTracesSampleRate,
  isSentryEnabled,
} from "@/lib/observability/sentry-env";
import { sanitizeSentryEvent } from "@/lib/observability/sentry-privacy";

type SharedInit = Pick<
  BrowserOptions & NodeOptions & EdgeOptions,
  | "dsn"
  | "enabled"
  | "environment"
  | "release"
  | "tracesSampleRate"
  | "sendDefaultPii"
> & {
  // Avoid duplicate @sentry/core type identity issues across package nests.
  beforeSend: typeof sanitizeSentryEvent;
};

/** Base options shared by client / server / edge inits. */
export function getSharedSentryOptions(): SharedInit {
  const dsn = getSentryDsn();
  const enabled = isSentryEnabled();
  const environment = getSentryEnvironment();
  const release = getSentryRelease();

  return {
    dsn,
    enabled,
    environment,
    ...(release ? { release } : {}),
    tracesSampleRate: getSentryTracesSampleRate(),
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
  };
}
