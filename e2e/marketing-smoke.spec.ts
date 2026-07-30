import { test, expect, type Page, type Request } from "@playwright/test";

/**
 * Marketing website smoke (P5.4):
 * - MKT-E2E-001 — locales + hreflang
 * - MKT-E2E-002 — key pages + pricing CTA → signup
 * - MKT-E2E-004 — cookie banner; PostHog gated until Accept
 *
 * No Supabase seed required — public marketing routes only.
 */

const LOCALES = ["bs", "hr", "sr", "en"] as const;

/** Traceability §8: home, pricing, features, FAQ, contact, legal, blog. */
const BS_HR_SR_PAGES = [
  "/",
  "/cijene",
  "/funkcije",
  "/faq",
  "/instalacija",
  "/kontakt",
  "/privacy",
  "/terms",
  "/dpa",
  "/blog",
] as const;

const EN_PAGES = [
  "/",
  "/pricing",
  "/features",
  "/faq",
  "/install",
  "/contact",
  "/privacy",
  "/terms",
  "/dpa",
  "/blog",
] as const;

const CONSENT_STORAGE_KEY = "dentord_cookie_consent";

function isPosthogRequest(req: Request) {
  return /posthog\.com|\/ingest\//i.test(req.url());
}

async function expectHreflang(page: Page) {
  for (const loc of LOCALES) {
    const link = page.locator(`link[rel="alternate"][hreflang="${loc}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", new RegExp(`/${loc}(/)?$`));
  }
  const xDefault = page.locator('link[rel="alternate"][hreflang="x-default"]');
  await expect(xDefault).toHaveCount(1);
  await expect(xDefault).toHaveAttribute("href", /\/bs(\/)?$/);
}

test.describe("Marketing smoke (MKT-E2E)", () => {
  test("MKT-E2E-001: /bs /hr /sr /en return 200 with hreflang", async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      const response = await page.goto(`/${locale}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `/${locale}`).toBe(200);
      await expectHreflang(page);
    }

    // Localized pricing slug also carries full alternate set (D37 / W17).
    const pricing = await page.goto("/bs/cijene", {
      waitUntil: "domcontentloaded",
    });
    expect(pricing?.status()).toBe(200);
    for (const loc of ["bs", "hr", "sr"] as const) {
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${loc}"]`),
      ).toHaveAttribute("href", new RegExp(`/${loc}/cijene$`));
    }
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", /\/en\/pricing$/);
  });

  test("MKT-E2E-002: marketing pages smoke + pricing CTA → signup", async ({
    page,
  }) => {
    for (const path of BS_HR_SR_PAGES) {
      const url = path === "/" ? "/bs" : `/bs${path}`;
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(response?.status(), url).toBe(200);
    }

    for (const path of EN_PAGES) {
      const url = path === "/" ? "/en" : `/en${path}`;
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(response?.status(), url).toBe(200);
    }

    // Spot-check hr/sr share Balkan pricing slug (strategy B).
    for (const locale of ["hr", "sr"] as const) {
      const response = await page.goto(`/${locale}/cijene`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `/${locale}/cijene`).toBe(200);
    }

    await page.goto("/bs/cijene", { waitUntil: "domcontentloaded" });
    // Dismiss cookie banner so it cannot intercept the plan CTA click.
    const banner = page.getByRole("dialog", { name: "Kolačići" });
    if (await banner.isVisible().catch(() => false)) {
      await banner.getByRole("button", { name: "Samo neophodni" }).click();
      await expect(banner).toBeHidden();
    }

    await page
      .getByRole("link", { name: "Registruj se besplatno" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/bs\/signup\/?$/);
    await expect(page.locator("#clinicName")).toBeVisible();
    await expect(page.getByText("Kreiraj ordinaciju")).toBeVisible();
  });

  test("MKT-E2E-004: cookie banner on fresh browser; PostHog gated", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const posthogHits: string[] = [];
    page.on("request", (req) => {
      if (isPosthogRequest(req)) posthogHits.push(req.url());
    });

    await page.goto("/bs", { waitUntil: "domcontentloaded" });

    const banner = page.getByRole("dialog", { name: "Kolačići" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "Politika privatnosti" })).toHaveAttribute(
      "href",
      /\/bs\/privacy/,
    );

    // Undecided → analytics must not load (W18 / §13.4).
    expect(posthogHits, "PostHog before consent").toEqual([]);

    await banner.getByRole("button", { name: "Samo neophodni" }).click();
    await expect(banner).toBeHidden();

    const rejected = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as { analytics: boolean }) : null;
    }, CONSENT_STORAGE_KEY);
    expect(rejected?.analytics).toBe(false);
    expect(posthogHits, "PostHog after reject").toEqual([]);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("dialog", { name: "Kolačići" })).toHaveCount(0);
    expect(posthogHits, "PostHog after reject reload").toEqual([]);

    // Accept path: clear choice, show banner again, opt in.
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, CONSENT_STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Prihvati" }).click();
    await expect(banner).toBeHidden();

    const accepted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as { analytics: boolean }) : null;
    }, CONSENT_STORAGE_KEY);
    expect(accepted?.analytics).toBe(true);

    // Without NEXT_PUBLIC_POSTHOG_KEY, init is a no-op — still zero network.
    // With key present, allow a short window for capture/ingest.
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      await expect
        .poll(() => posthogHits.length, { timeout: 10_000 })
        .toBeGreaterThan(0);
    } else {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      expect(posthogHits, "PostHog without key stays silent").toEqual([]);
    }

    await context.close();
  });
});
