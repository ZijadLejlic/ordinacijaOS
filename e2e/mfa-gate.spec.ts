import { expect, test } from "@playwright/test";
import { hardDeleteClinic } from "../lib/clinic/hard-delete";
import { OWNER_MFA_ENROLL_ENFORCED } from "../lib/auth/mfa";
import { getE2EEnv } from "./helpers/env";
import { createServiceClient, randomTag } from "./helpers/supabase";

const hasEnv = Boolean(getE2EEnv());

test.describe("Owner MFA gate (D11)", () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  const tag = randomTag();
  const email = `e2e-mfa-owner-${tag}@ordinacijaos.test`;
  const password = `E2E-${tag}!Aa1`;
  let clinicId: string | null = null;
  let userId: string | null = null;

  test.beforeAll(async () => {
    const service = createServiceClient();

    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "createUser failed");
    }
    userId = created.data.user.id;

    const { data: plan, error: planError } = await service
      .from("plans")
      .select("id")
      .eq("code", "professional")
      .single();
    if (planError || !plan) {
      throw new Error(planError?.message ?? "plan not found");
    }

    const { data: clinic, error: clinicError } = await service
      .from("clinics")
      .insert({
        name: `E2E MFA Gate ${tag}`,
        plan_id: plan.id,
        trial_ends_at: "2026-12-31T23:59:59+00:00",
      })
      .select("id")
      .single();
    if (clinicError || !clinic) {
      throw new Error(clinicError?.message ?? "clinic insert failed");
    }
    clinicId = clinic.id;

    const { error: profileError } = await service.from("profiles").insert({
      id: userId,
      clinic_id: clinicId,
      role: "owner",
      full_name: `E2E MFA Owner ${tag}`,
      is_active: true,
    });
    if (profileError) {
      throw new Error(profileError.message);
    }
  });

  test.afterAll(async () => {
    if (!clinicId) return;
    const service = createServiceClient();
    await service
      .from("clinics")
      .update({ status: "pending_delete" })
      .eq("id", clinicId);
    const result = await hardDeleteClinic(service, clinicId);
    if (!result.ok) {
      await service.from("clinics").delete().eq("id", clinicId);
      if (userId) {
        await service.auth.admin.deleteUser(userId).catch(() => undefined);
      }
    }
  });

  test("owner without enrolled MFA: enroll gate respects OWNER_MFA_ENROLL_ENFORCED", async ({
    page,
  }) => {
    await page.goto("/bs/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Prijavi se" }).click();

    if (OWNER_MFA_ENROLL_ENFORCED) {
      await page.waitForURL(/\/mfa\/enroll/, { timeout: 20_000 });
      await page.goto("/bs/dashboard");
      await page.waitForURL(/\/mfa\/enroll/, { timeout: 20_000 });
      return;
    }

    // Free-trial deferral: no enroll redirect; app (onboarding/dashboard) is reachable.
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 20_000 });
    expect(page.url()).not.toMatch(/\/mfa\//);
    await page.goto("/bs/dashboard");
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 20_000 });
    expect(page.url()).not.toMatch(/\/mfa\//);
  });
});
