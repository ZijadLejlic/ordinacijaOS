"use client";

import { useEffect } from "react";
import {
  CONSENT_CHANGED_EVENT,
  type CookieConsentDetail,
  hasAnalyticsConsent,
} from "@/lib/analytics/consent";
import { initPosthog, optOutPosthog } from "@/lib/analytics/posthog";

/**
 * Loads PostHog only after analytics cookie consent (W18).
 * Listens for consent changes so Accept mid-session still enables capture.
 */
export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (hasAnalyticsConsent()) {
      initPosthog();
    }

    function onConsent(event: Event) {
      const detail = (event as CustomEvent<CookieConsentDetail>).detail;
      if (detail?.analytics) {
        initPosthog();
      } else {
        optOutPosthog();
      }
    }

    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent);
  }, []);

  return children;
}
