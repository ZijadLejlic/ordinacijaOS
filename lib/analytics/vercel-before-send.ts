import type { BeforeSendEvent as AnalyticsBeforeSendEvent } from "@vercel/analytics";
import type { BeforeSendMiddleware as SpeedInsightsBeforeSend } from "@vercel/speed-insights";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";

type UrlEvent = { url: string };

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const SENSITIVE_QUERY_KEYS = [
  "token",
  "code",
  "invite",
  "secret",
  "access_token",
  "refresh_token",
] as const;

/** Redact IDs / tokens from pageview URLs before they leave the browser (D33). */
export function redactAnalyticsUrl(urlString: string): string {
  const url = new URL(urlString);
  url.pathname = url.pathname.replace(UUID_RE, "[id]");
  for (const key of SENSITIVE_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
  return url.toString();
}

/** Consent gate + URL redaction for Vercel Analytics / Speed Insights events. */
function gateAndRedact<T extends UrlEvent>(event: T): T | null {
  if (!hasAnalyticsConsent()) return null;
  return {
    ...event,
    url: redactAnalyticsUrl(event.url),
  };
}

/** Gate Vercel Web Analytics on cookie consent (W18). */
export function vercelAnalyticsBeforeSend(
  event: AnalyticsBeforeSendEvent,
): AnalyticsBeforeSendEvent | null {
  return gateAndRedact(event);
}

/** Gate Vercel Speed Insights on cookie consent (W18). */
export const vercelSpeedInsightsBeforeSend: SpeedInsightsBeforeSend = (event) =>
  gateAndRedact(event);
