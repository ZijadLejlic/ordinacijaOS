import posthog from "posthog-js";

export type AnalyticsProps = {
  clinic_id?: string;
  role?: string;
  [key: string]: string | number | boolean | undefined;
};

const BLOCKED_KEYS = /name|email|phone|patient|address|jmbg|oib|iban/i;

let initialized = false;

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

export function isPosthogEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function initPosthog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key || typeof window === "undefined" || initialized) return;

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

/** Product analytics without patient PII (D33). */
export function trackEvent(event: string, props?: AnalyticsProps) {
  if (!isPosthogEnabled() || typeof window === "undefined") return;
  posthog.capture(event, sanitizeProps(props));
}

export function identifyClinicUser(input: {
  userId: string;
  clinicId: string;
  role: string;
}) {
  if (!isPosthogEnabled() || typeof window === "undefined") return;
  posthog.identify(input.userId, {
    clinic_id: input.clinicId,
    role: input.role,
  });
  posthog.group("clinic", input.clinicId);
}
