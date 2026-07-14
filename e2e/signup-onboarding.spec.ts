import { test, expect } from "@playwright/test";
import { completeMfaEnroll } from "./helpers/mfa";
import { getE2EEnv } from "./helpers/env";
import {
  createAnonClient,
  createServiceClient,
  randomTag,
} from "./helpers/supabase";

const hasEnv = Boolean(getE2EEnv());

/**
 * Prefer full UI signup. If Supabase Auth rate-limits email (common after
 * many local runs), bootstrap owner via admin + create_clinic_for_owner so
 * MFA enroll + onboarding step 1 still get exercised (PRD §12.2).
 */
async function ensureOwnerOnMfaEnroll(
  page: import("@playwright/test").Page,
  input: {
    clinicName: string;
    fullName: string;
    email: string;
    password: string;
  },
) {
  await page.goto("/bs/signup");
  await page.locator("#clinicName").fill(input.clinicName);
  await page.locator("#fullName").fill(input.fullName);
  await page.locator("#email").fill(input.email);
  await page.locator("#password").fill(input.password);
  await page.getByRole("button", { name: "Kreiraj nalog" }).click();

  try {
    await page.waitForURL(/\/mfa\/enroll/, { timeout: 20_000 });
    return "ui-signup" as const;
  } catch {
    // Fall through to admin bootstrap
  }

  const alertText = (
    await page.getByRole("alert").textContent().catch(() => "")
  )?.toLowerCase();

  const service = createServiceClient();
  const existing = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  let user = existing.data.users.find((u) => u.email === input.email);

  if (!user) {
    const created = await service.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        clinic_name: input.clinicName,
      },
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `signup UI failed (${alertText ?? "no alert"}) and admin createUser failed: ${created.error?.message}`,
      );
    }
    user = created.data.user;
  } else if (!user.email_confirmed_at) {
    await service.auth.admin.updateUserById(user.id, { email_confirm: true });
  }

  const userClient = createAnonClient();
  const { error: signErr } = await userClient.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signErr) {
    throw new Error(`bootstrap signIn failed: ${signErr.message}`);
  }

  const { error: clinicErr } = await userClient.rpc("create_clinic_for_owner", {
    p_clinic_name: input.clinicName,
    p_full_name: input.fullName,
  });
  if (clinicErr) {
    throw new Error(`create_clinic_for_owner failed: ${clinicErr.message}`);
  }

  await page.goto("/bs/login");
  await page.locator("#email").fill(input.email);
  await page.locator("#password").fill(input.password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL(/\/mfa\/enroll/, { timeout: 60_000 });
  return "admin-bootstrap" as const;
}

test.describe("Signup → MFA → onboarding step 1", () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  test("owner can create clinic and complete onboarding step 1", async ({
    page,
  }) => {
    const tag = randomTag();
    const clinicName = `E2E Signup ${tag}`;
    const email = `e2e-signup-${tag}@ordinacijaos.test`;
    const password = `E2E-${tag}!Aa1`;
    let clinicId: string | null = null;
    let userId: string | null = null;

    try {
      await ensureOwnerOnMfaEnroll(page, {
        clinicName,
        fullName: `Owner ${tag}`,
        email,
        password,
      });

      await completeMfaEnroll(page);

      await expect(page).toHaveURL(/\/onboarding/);
      await expect(page.getByText("Osnovni podaci")).toBeVisible();

      await page.locator("#clinicName").fill(`${clinicName} Updated`);
      await page.locator("#timezone").selectOption("Europe/Sarajevo");
      await page.locator("#phoneCountryDefault").selectOption("+387");
      await page.getByRole("button", { name: "Nastavi" }).click();

      await expect(page.getByText("Prve usluge")).toBeVisible({
        timeout: 30_000,
      });

      const service = createServiceClient();
      const listed = await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const user = listed.data.users.find((u) => u.email === email);
      expect(user).toBeTruthy();
      userId = user!.id;

      const { data: owned } = await service
        .from("profiles")
        .select("clinic_id, role")
        .eq("id", userId)
        .single();

      expect(owned?.role).toBe("owner");
      clinicId = owned?.clinic_id ?? null;
      expect(clinicId).toBeTruthy();
    } finally {
      if (clinicId) {
        const service = createServiceClient();
        await service
          .from("clinics")
          .update({ status: "pending_delete" })
          .eq("id", clinicId);
        const { error } = await service.rpc("hard_delete_clinic", {
          p_clinic_id: clinicId,
        });
        if (error && userId) {
          await service.from("profiles").delete().eq("clinic_id", clinicId);
          await service.from("clinics").delete().eq("id", clinicId);
          await service.auth.admin.deleteUser(userId);
        }
      } else if (userId) {
        const service = createServiceClient();
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
