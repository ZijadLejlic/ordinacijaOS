const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type SentryMod = typeof import("@sentry/nextjs");

let sentryPromise: Promise<SentryMod> | null = null;

function loadSentry() {
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then((Sentry) => {
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
 */
function scheduleSentryInit() {
  if (!dsn || typeof window === "undefined") return;
  const run = () => {
    void loadSentry();
  };

  if (!isClinicAppPath(window.location.pathname)) {
    window.setTimeout(run, 20_000);
    return;
  }

  const ric = (
    window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: 4000 });
  } else {
    setTimeout(run, 3000);
  }
}

scheduleSentryInit();

export const onRouterTransitionStart = (
  ...args: Parameters<SentryMod["captureRouterTransitionStart"]>
) => {
  void loadSentry().then((Sentry) => {
    Sentry.captureRouterTransitionStart(...args);
  });
};
