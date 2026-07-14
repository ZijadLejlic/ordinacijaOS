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

/** Complete MFA enroll UI: wait for secret, submit TOTP, land past MFA gate. */
export async function completeMfaEnroll(page: Page): Promise<string> {
  await page.waitForURL(/\/mfa\/enroll/, { timeout: 60_000 });
  const secretLocator = page.locator("code").first();
  await secretLocator.waitFor({ state: "visible", timeout: 60_000 });
  const secret = (await secretLocator.innerText()).trim();
  if (!secret || secret.length < 16) {
    throw new Error(`MFA enroll secret missing or too short: "${secret}"`);
  }

  await page.locator("#code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Aktiviraj 2FA" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/mfa/"), {
    timeout: 60_000,
  });
  return secret;
}

/** Complete MFA verify UI when owner already has a factor. */
export async function completeMfaVerify(page: Page, secret: string) {
  await page.waitForURL(/\/mfa\/verify/, { timeout: 60_000 });
  await page.locator("#code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Potvrdi" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/mfa/"), {
    timeout: 60_000,
  });
}
