import { hasAnalyticsConsent } from "@/lib/analytics/consent";

export type AnalyticsProps = {
  clinic_id?: string;
  role?: string;
  [key: string]: string | number | boolean | undefined;
};

type PosthogClient = typeof import("posthog-js").default;

const BLOCKED_KEYS = /name|email|phone|patient|address|jmbg|oib|iban/i;

let initialized = false;
let client: PosthogClient | null = null;
let loadPromise: Promise<PosthogClient> | null = null;

function sanitizeProps(
  props?: AnalyticsProps,
): Record<string, string | number | boolean> {
  if (!props) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (BLOCKED_KEYS.test(key)) continue;
    out[key] = value;
  }
  return out;
}

function loadPosthog() {
  if (!loadPromise) {
    loadPromise = import("posthog-js").then((mod) => {
      client = mod.default;
      return mod.default;
    });
  }
  return loadPromise;
}

export function isPosthogEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

/** True when key is present and user accepted analytics cookies (W18). */
export function canUsePosthog() {
  return isPosthogEnabled() && hasAnalyticsConsent();
}

/**
 * Init PostHog only after analytics consent (PRD §13.4 / W18).
 * Dynamic-imports posthog-js so marketing first paint stays light.
 * No-ops when key missing, SSR, already initialized, or consent denied/undecided.
 */
export function initPosthog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key || typeof window === "undefined" || initialized) return;
  if (!hasAnalyticsConsent()) return;

  void loadPosthog().then((posthog) => {
    if (initialized || !hasAnalyticsConsent()) return;
    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
    });
    initialized = true;
  });
}

/** Stop capturing if the user later rejects analytics. */
export function optOutPosthog() {
  if (typeof window === "undefined") return;
  if (initialized && client) {
    client.opt_out_capturing();
    client.reset();
  }
}

/** Product analytics without patient PII (D33). */
export function trackEvent(event: string, props?: AnalyticsProps) {
  if (!canUsePosthog() || typeof window === "undefined" || !initialized || !client)
    return;
  client.capture(event, sanitizeProps(props));
}

export function identifyClinicUser(input: {
  userId: string;
  clinicId: string;
  role: string;
  /** Marketing demo clinic — skip conversion identify (W8). */
  skipIdentify?: boolean;
}) {
  if (!canUsePosthog() || typeof window === "undefined" || !initialized || !client)
    return;
  if (input.skipIdentify) return;
  client.identify(input.userId, {
    clinic_id: input.clinicId,
    role: input.role,
  });
  client.group("clinic", input.clinicId);
}
