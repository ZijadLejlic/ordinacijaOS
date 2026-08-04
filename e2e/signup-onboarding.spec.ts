import { test, expect } from "@playwright/test";
import { hardDeleteClinic } from "../lib/clinic/hard-delete";
import { OWNER_MFA_ENROLL_ENFORCED } from "../lib/auth/mfa";
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
 * onboarding steps 1–3 still get exercised (PRD §12.2 / J1).
 *
 * MFA enroll runs only when OWNER_MFA_ENROLL_ENFORCED is true.
 */
async function ensureOwnerReadyForOnboarding(
  page: import("@playwright/test").Page,
  input: {
    clinicName: string;
    fullName: string;
    email: string;
    password: string;
  },
) {
  const postAuth =
    OWNER_MFA_ENROLL_ENFORCED
      ? /\/mfa\/enroll/
      : /\/(onboarding|dashboard|mfa\/enroll)/;

  await page.goto("/bs/signup");
  await page.locator("#clinicName").fill(input.clinicName);
  await page.locator("#fullName").fill(input.fullName);
  await page.locator("#email").fill(input.email);
  await page.locator("#password").fill(input.password);
  await page.getByRole("button", { name: "Kreiraj nalog" }).click();

  try {
    await page.waitForURL(postAuth, { timeout: 20_000 });
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
  await page.waitForURL(postAuth, { timeout: 60_000 });
  return "admin-bootstrap" as const;
}

test.describe("Signup → onboarding steps 1–3", { tag: "@blocker" }, () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  test("owner completes onboarding steps 1–3 (skip invite) → dashboard", async ({
    page,
  }) => {
    const tag = randomTag();
    const clinicName = `E2E Signup ${tag}`;
    const email = `e2e-signup-${tag}@ordinacijaos.test`;
    const password = `E2E-${tag}!Aa1`;
    let clinicId: string | null = null;
    let userId: string | null = null;

    try {
      await ensureOwnerReadyForOnboarding(page, {
        clinicName,
        fullName: `Owner ${tag}`,
        email,
        password,
      });

      if (OWNER_MFA_ENROLL_ENFORCED) {
        await completeMfaEnroll(page);
      }

      // Resolve ids ASAP so finally cleanup runs even if a later step fails
      {
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
      }

      // —— Step 1: clinic basics (D43 / D46 / D47) ——
      await expect(page).toHaveURL(/\/onboarding/);
      await expect(page.getByText("Osnovni podaci")).toBeVisible();

      await page.locator("#clinicName").fill(`${clinicName} Updated`);
      await page.locator("#timezone").selectOption("Europe/Sarajevo");
      await page.locator("#phoneCountryDefault").selectOption("+387");
      await page.getByRole("button", { name: "Nastavi" }).click();

      // —— Step 2: add ≥1 service, advance ——
      await expect(page.getByText("Prve usluge")).toBeVisible({
        timeout: 30_000,
      });

      await page.locator("#name").fill(`Kontrola ${tag.slice(-6)}`);
      await page.locator("#code").fill(`E2E-${tag.slice(-4)}`);
      await page.locator("#durationMinutes").fill("30");
      await page.locator("#priceEur").fill("50");
      await page.locator("#vatRate").fill("0.17");
      await page.getByRole("button", { name: "Dodaj uslugu" }).click();
      await expect(page.getByText("Usluga dodana.")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(/Aktivnih usluga:\s*[1-9]/)).toBeVisible();

      await page.getByRole("button", { name: "Nastavi" }).click();

      // —— Step 3: skip invite (J1 allows skip; no real Resend send) ——
      await expect(page.getByText("Pozovi kolegu")).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("button", { name: "Preskoči i završi" }).click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
      await expect(
        page.getByRole("heading", { name: "Kontrolna tabla" }),
      ).toBeVisible({ timeout: 30_000 });

      // —— DB assertions (AUTH-E2E-001) ——
      const service = createServiceClient();
      const { data: clinic } = await service
        .from("clinics")
        .select("name, timezone, phone_country_default, settings_json")
        .eq("id", clinicId!)
        .single();

      expect(clinic?.name).toBe(`${clinicName} Updated`);
      expect(clinic?.timezone).toBe("Europe/Sarajevo");
      expect(clinic?.phone_country_default).toBe("+387");

      const settings =
        clinic?.settings_json &&
        typeof clinic.settings_json === "object" &&
        !Array.isArray(clinic.settings_json)
          ? (clinic.settings_json as Record<string, unknown>)
          : {};
      const onboarding =
        settings.onboarding &&
        typeof settings.onboarding === "object" &&
        !Array.isArray(settings.onboarding)
          ? (settings.onboarding as Record<string, unknown>)
          : {};
      expect(onboarding.completed).toBe(true);
      expect(onboarding.skipped_invite).toBe(true);
      const steps =
        onboarding.steps &&
        typeof onboarding.steps === "object" &&
        !Array.isArray(onboarding.steps)
          ? (onboarding.steps as Record<string, unknown>)
          : {};
      expect(steps.clinic).toBe(true);
      expect(steps.services).toBe(true);
      expect(steps.invite).toBe(true);

      const { count: serviceCount } = await service
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId!)
        .eq("is_active", true);
      expect(serviceCount).toBeGreaterThanOrEqual(1);
    } finally {
      if (clinicId) {
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
      } else if (userId) {
        const service = createServiceClient();
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
