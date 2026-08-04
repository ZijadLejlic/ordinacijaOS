import { Secret, TOTP } from "otpauth";
import type { Page } from "@playwright/test";

/** Generate a current TOTP code from a base32 secret shown on /mfa/enroll. */
export function totpCode(secret: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret.replace(/\s+/g, "")),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

/** Complete MFA enroll UI wizard: install → scan → confirm TOTP. */
export async function completeMfaEnroll(page: Page): Promise<string> {
  await page.waitForURL(/\/mfa\/enroll/, { timeout: 60_000 });

  // Step 1 → 2
  await page.getByRole("button", { name: "Nastavi" }).click();

  const secretLocator = page.locator("code").first();
  await secretLocator.waitFor({ state: "visible", timeout: 60_000 });
  const secret = (await secretLocator.innerText()).trim();
  if (!secret || secret.length < 16) {
    throw new Error(`MFA enroll secret missing or too short: "${secret}"`);
  }

  // Step 2 → 3
  await page.getByRole("button", { name: "Nastavi" }).click();

  const codeInput = page.locator("#code");
  await codeInput.waitFor({ state: "visible", timeout: 15_000 });
  await codeInput.fill(totpCode(secret));

  // Auto-submit on 6 digits; keep explicit click as fallback.
  const activate = page.getByRole("button", { name: "Aktiviraj 2FA" });
  if (await activate.isEnabled().catch(() => false)) {
    await activate.click().catch(() => undefined);
  }

  await page.waitForURL((url) => !url.pathname.includes("/mfa/"), {
    timeout: 60_000,
  });
  return secret;
}

/** Complete MFA verify UI when owner already has a factor. */
export async function completeMfaVerify(page: Page, secret: string) {
  await page.waitForURL(/\/mfa\/verify/, { timeout: 60_000 });
  const codeInput = page.locator("#code");
  await codeInput.fill(totpCode(secret));

  const confirm = page.getByRole("button", { name: "Potvrdi" });
  if (await confirm.isEnabled().catch(() => false)) {
    await confirm.click().catch(() => undefined);
  }

  await page.waitForURL((url) => !url.pathname.includes("/mfa/"), {
    timeout: 60_000,
  });
}
