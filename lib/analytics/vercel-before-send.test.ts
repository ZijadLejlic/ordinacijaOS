import { afterEach, describe, expect, it, vi } from "vitest";

describe("redactAnalyticsUrl", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("replaces UUIDs in the path and strips sensitive query params", async () => {
    const { redactAnalyticsUrl } = await import(
      "@/lib/analytics/vercel-before-send"
    );

    const pathRedacted = redactAnalyticsUrl(
      "https://dentord.com/bs/patients/a1b2c3d4-e5f6-4711-8abc-def012345678/chart",
    );
    expect(pathRedacted).toContain("/patients/[id]/chart");
    expect(pathRedacted).not.toContain("a1b2c3d4");

    const queryRedacted = redactAnalyticsUrl(
      "https://dentord.com/bs/invite?token=secret&next=/dashboard",
    );
    expect(queryRedacted).not.toContain("token=");
    expect(queryRedacted).toContain("next=%2Fdashboard");
  });
});

describe("vercelAnalyticsBeforeSend", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("drops events without analytics consent", async () => {
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

    const { vercelAnalyticsBeforeSend } = await import(
      "@/lib/analytics/vercel-before-send"
    );

    expect(
      vercelAnalyticsBeforeSend({
        type: "pageview",
        url: "https://dentord.com/bs",
      }),
    ).toBeNull();
  });

  it("allows events when consent is granted and redacts patient ids", async () => {
    const store = new Map<string, string>();
    store.set(
      "dentord_cookie_consent",
      JSON.stringify({
        analytics: true,
        decidedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
      dispatchEvent: vi.fn(),
    });

    const { vercelAnalyticsBeforeSend, vercelSpeedInsightsBeforeSend } =
      await import("@/lib/analytics/vercel-before-send");

    const analytics = vercelAnalyticsBeforeSend({
      type: "pageview",
      url: "https://dentord.com/bs/patients/a1b2c3d4-e5f6-4711-8abc-def012345678",
    });
    expect(analytics).not.toBeNull();
    expect(analytics?.url).toContain("/patients/[id]");

    const vital = vercelSpeedInsightsBeforeSend({
      type: "vital",
      url: "https://dentord.com/bs/patients/a1b2c3d4-e5f6-4711-8abc-def012345678",
    });
    expect(vital).not.toBeNull();
    expect(vital && vital.url).toContain("/patients/[id]");
  });
});
