const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type SentryMod = typeof import("@sentry/nextjs");

let sentryPromise: Promise<SentryMod> | null = null;

function loadSentry() {
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then(async (Sentry) => {
      const { getSharedSentryOptions } = await import(
        "@/lib/observability/sentry-options"
      );
      const { isSentryEnabled } = await import(
        "@/lib/observability/sentry-env"
      );
      const shared = getSharedSentryOptions();
      Sentry.init({
        ...shared,
        integrations: shared.enabled
          ? [
              Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
              }),
            ]
          : [],
        replaysSessionSampleRate: shared.enabled ? 0.01 : 0,
        replaysOnErrorSampleRate: shared.enabled ? 1.0 : 0,
        debug:
          process.env.NODE_ENV === "development" &&
          isSentryEnabled() &&
          process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",
      });
      return Sentry;
    });
  }
  return sentryPromise;
}

/** Clinic app routes — load Sentry soon. Marketing stays light for LCP. */
function isClinicAppPath(pathname: string) {
  const stripped = pathname.replace(/^\/(bs|en)(?=\/|$)/, "") || "/";
  const prefixes = [
    "/dashboard",
    "/patients",
    "/calendar",
    "/settings",
    "/invoices",
    "/crm",
    "/inventory",
    "/expenses",
    "/services",
    "/onboarding",
    "/platform",
    "/pin",
    "/mfa",
    "/login",
    "/signup",
    "/invite",
  ];
  return prefixes.some((p) => stripped === p || stripped.startsWith(`${p}/`));
}

/**
 * Defer client SDK. Marketing pages wait long enough that Lighthouse does not
 * download ~170KB of mostly-unused Sentry during the audit window.
 * Clinic + verification paths init promptly.
 */
function scheduleSentryInit() {
  if (!dsn || typeof window === "undefined") return;

  const run = () => {
    void import("@/lib/observability/sentry-env").then(({ isSentryEnabled }) => {
      if (!isSentryEnabled()) return;
      void loadSentry();
    });
  };

  if (isClinicAppPath(window.location.pathname)) {
    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      ric(run, { timeout: 1500 });
    } else {
      setTimeout(run, 500);
    }
    return;
  }

  window.setTimeout(run, 20_000);
}

scheduleSentryInit();

export const onRouterTransitionStart = (
  ...args: Parameters<SentryMod["captureRouterTransitionStart"]>
) => {
  void import("@/lib/observability/sentry-env").then(({ isSentryEnabled }) => {
    if (!isSentryEnabled()) return;
    void loadSentry().then((Sentry) => {
      Sentry.captureRouterTransitionStart(...args);
    });
  });
};
