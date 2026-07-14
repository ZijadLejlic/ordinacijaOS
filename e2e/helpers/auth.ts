import type { Page } from "@playwright/test";
import { completeMfaVerify } from "./mfa";

export async function loginAs(
  page: Page,
  email: string,
  password: string,
  options?: { mfaSecret?: string },
) {
  await page.goto("/bs/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Prijavi se" }).click();

  if (options?.mfaSecret) {
    await page.waitForURL(/\/(mfa\/|onboarding|dashboard|calendar|patients|invoices)/, {
      timeout: 60_000,
    });
    if (page.url().includes("/mfa/verify")) {
      await completeMfaVerify(page, options.mfaSecret);
    }
  } else {
    await page.waitForURL(
      (url) =>
        !url.pathname.includes("/bs/login") && !url.pathname.includes("/mfa/"),
      { timeout: 60_000 },
    );
  }
}
