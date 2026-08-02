"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { vercelSpeedInsightsBeforeSend } from "@/lib/analytics/vercel-before-send";

/** Vercel Speed Insights — consent-gated + URL redaction (W18 / D33). */
export function VercelSpeedInsights() {
  return <SpeedInsights beforeSend={vercelSpeedInsightsBeforeSend} />;
}
