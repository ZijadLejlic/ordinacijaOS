import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { getE2EEnv } from "./helpers/env";
import {
  cleanupSeededUsers,
  seedOperationalClinic,
  type SeededClinic,
  type SeededUser,
} from "./helpers/seed";

const hasEnv = Boolean(getE2EEnv());

test.describe("Invoice + PDF", () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  let seeded: SeededClinic & { cleanupUsers: SeededUser[] };

  test.beforeAll(async () => {
    seeded = await seedOperationalClinic();
  });

  test.afterAll(async () => {
    if (seeded?.cleanupUsers) {
      await cleanupSeededUsers(seeded.cleanupUsers);
    }
  });

  test("accountant can create invoice and download PDF", async ({ page }) => {
    const accountant = seeded.accountant!;
    const patientId = seeded.patientId!;
    const serviceId = seeded.serviceId!;

    await loginAs(page, accountant.email, accountant.password);
    await page.goto("/bs/invoices");

    await expect(page.getByText("Nova faktura")).toBeVisible();

    await page.getByTestId("invoice-patient").selectOption(patientId);
    // Selecting a service updates React-controlled linesJson (fill() does not).
    await page.getByTestId("invoice-line-service").selectOption(serviceId);
    await expect(page.getByPlaceholder("Opis")).not.toHaveValue("");

    await page.getByRole("button", { name: "Izdaj fakturu" }).click();

    await expect(page.getByText("Faktura kreirana.")).toBeVisible({
      timeout: 60_000,
    });

    const openLink = page.getByRole("link", { name: "Otvori" }).first();
    await expect(openLink).toBeVisible();
    const href = await openLink.getAttribute("href");
    expect(href).toMatch(/\/invoices\/[0-9a-f-]+/);

    await openLink.click();
    await expect(page.getByRole("link", { name: "Preuzmi PDF" })).toBeVisible({
      timeout: 30_000,
    });

    const pdfLink = page.getByRole("link", { name: "Preuzmi PDF" });
    const pdfHref = await pdfLink.getAttribute("href");
    expect(pdfHref).toMatch(/\/api\/invoices\/.+\/pdf/);

    const response = await page.request.get(pdfHref!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(100);
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
  });
});
