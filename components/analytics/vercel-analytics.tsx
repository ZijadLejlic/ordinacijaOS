"use client";

import { Analytics } from "@vercel/analytics/next";
import { vercelAnalyticsBeforeSend } from "@/lib/analytics/vercel-before-send";

/** Vercel Web Analytics — consent-gated + URL redaction (W18 / D33). */
export function VercelAnalytics() {
  return <Analytics beforeSend={vercelAnalyticsBeforeSend} />;
}
