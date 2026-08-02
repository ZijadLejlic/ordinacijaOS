"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  CONSENT_STORAGE_KEY,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/analytics/consent";
import { cn } from "@/lib/utils";

function subscribeConsent(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CONSENT_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function getConsentNeeded() {
  return readCookieConsent() === null;
}

/**
 * Minimal cookie banner (PRD §13.4 / W18): essential vs analytics.
 * PostHog + Vercel Web Analytics / Speed Insights load only after Accept.
 */
export function CookieConsentBanner() {
  const t = useTranslations("Marketing.cookieConsent");
  const needsConsent = useSyncExternalStore(
    subscribeConsent,
    getConsentNeeded,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const visible = needsConsent && !dismissed;

  if (!visible) return null;

  function decide(analytics: boolean) {
    writeCookieConsent(analytics);
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-[color-mix(in_oklab,var(--marketing-ink)_12%,transparent)]",
        "bg-[var(--marketing-surface)]/95 backdrop-blur-md",
        "px-4 py-4 shadow-[0_-8px_30px_rgba(15,27,61,0.08)] md:px-6",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p
            id="cookie-consent-title"
            className="text-sm font-medium text-[var(--marketing-ink)]"
          >
            {t("title")}
          </p>
          <p
            id="cookie-consent-desc"
            className="mt-1 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]"
          >
            {t("description")}{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-[var(--marketing-ink)]"
            >
              {t("privacyLink")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => decide(false)}
            className="border-[color-mix(in_oklab,var(--marketing-ink)_20%,transparent)] text-[var(--marketing-ink)]"
          >
            {t("reject")}
          </Button>
          <Button type="button" size="sm" onClick={() => decide(true)}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
