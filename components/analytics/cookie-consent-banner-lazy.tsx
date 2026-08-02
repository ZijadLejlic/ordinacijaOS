"use client";

import dynamic from "next/dynamic";

/** Defer cookie banner JS off the marketing critical path (LCP). */
export const CookieConsentBannerLazy = dynamic(
  () =>
    import("@/components/analytics/cookie-consent-banner").then((m) => ({
      default: m.CookieConsentBanner,
    })),
  { ssr: false },
);
