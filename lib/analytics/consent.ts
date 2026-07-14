/** Cookie / analytics consent (PRD §13.4, W18). Essential always on; analytics opt-in. */

export const CONSENT_STORAGE_KEY = "dentord_cookie_consent";
export const CONSENT_CHANGED_EVENT = "dentord:cookie-consent";

export type CookieConsentChoice = {
  /** Analytics cookies (PostHog). Essential cookies do not need opt-in. */
  analytics: boolean;
  decidedAt: string;
};

export type CookieConsentDetail = {
  analytics: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentChoice>;
    if (typeof parsed.analytics !== "boolean") return null;
    return {
      analytics: parsed.analytics,
      decidedAt:
        typeof parsed.decidedAt === "string"
          ? parsed.decidedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function writeCookieConsent(analytics: boolean): CookieConsentChoice {
  const choice: CookieConsentChoice = {
    analytics,
    decidedAt: new Date().toISOString(),
  };
  if (isBrowser()) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
    window.dispatchEvent(
      new CustomEvent<CookieConsentDetail>(CONSENT_CHANGED_EVENT, {
        detail: { analytics },
      }),
    );
  }
  return choice;
}
