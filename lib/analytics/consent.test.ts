import { afterEach, describe, expect, it, vi } from "vitest";

describe("cookie consent storage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("returns null when unset and persists accept/reject", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
      dispatchEvent: vi.fn(),
    });

    const {
      CONSENT_STORAGE_KEY,
      hasAnalyticsConsent,
      readCookieConsent,
      writeCookieConsent,
    } = await import("@/lib/analytics/consent");

    expect(readCookieConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);

    writeCookieConsent(true);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(JSON.parse(store.get(CONSENT_STORAGE_KEY)!).analytics).toBe(true);

    writeCookieConsent(false);
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
