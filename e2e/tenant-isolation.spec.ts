import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { getE2EEnv } from "./helpers/env";
import {
  cleanupSeededUsers,
  createPatient,
  createSeededUser,
  type SeededUser,
} from "./helpers/seed";
import { createServiceClient } from "./helpers/supabase";

const hasEnv = Boolean(getE2EEnv());

test.describe("Tenant isolation (UI)", () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  let clinicA: SeededUser;
  let clinicB: SeededUser;
  let patientBId: string;
  let patientBName: string;
  const cleanupUsers: SeededUser[] = [];

  test.beforeAll(async () => {
    const service = createServiceClient();
    clinicA = await createSeededUser(service, {
      clinicName: `E2E Tenant A`,
      role: "doctor",
    });
    clinicB = await createSeededUser(service, {
      clinicName: `E2E Tenant B`,
      role: "doctor",
    });
    cleanupUsers.push(clinicA, clinicB);

    const patientB = await createPatient(service, clinicB.clinicId, {
      firstName: "Secret",
      lastName: "ClinicBOnly",
    });
    patientBId = patientB.id;
    patientBName = `${patientB.last_name} ${patientB.first_name}`;

    await createPatient(service, clinicA.clinicId, {
      firstName: "Visible",
      lastName: "ClinicA",
    });
  });

  test.afterAll(async () => {
    await cleanupSeededUsers(cleanupUsers);
  });

  test("clinic A cannot see clinic B patient in list or by URL", async ({
    page,
  }) => {
    await loginAs(page, clinicA.email, clinicA.password);

    await page.goto("/bs/patients");
    await expect(page.getByText("ClinicA Visible")).toBeVisible();
    await expect(page.getByText(patientBName)).toHaveCount(0);

    const response = await page.goto(`/bs/patients/${patientBId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(patientBName)).toHaveCount(0);
  });
});
