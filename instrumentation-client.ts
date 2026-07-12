import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  debug: process.env.NODE_ENV === "development" && Boolean(dsn),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: dsn ? 0.1 : 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
