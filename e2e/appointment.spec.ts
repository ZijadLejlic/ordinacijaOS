import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { getE2EEnv } from "./helpers/env";
import {
  cleanupSeededUsers,
  createPatient,
  seedOperationalClinic,
  type SeededClinic,
  type SeededUser,
} from "./helpers/seed";
import { createServiceClient } from "./helpers/supabase";

const hasEnv = Boolean(getE2EEnv());

/** Tomorrow at HH:MM / HH:MM+30 as datetime-local wall clock. */
function wallClockTomorrow(hour: number, minute: number) {
  const now = new Date();
  const date = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const start = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const endMinute = minute + 30;
  const endHour = hour + Math.floor(endMinute / 60);
  const end = `${yyyy}-${mm}-${dd}T${String(endHour).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
  return { startsLocal: start, endsLocal: end };
}

test.describe("Appointment scheduling", () => {
  test.skip(!hasEnv, "Supabase E2E env not configured");

  let seeded: SeededClinic & { cleanupUsers: SeededUser[] };
  let patientBId: string;

  test.beforeAll(async () => {
    seeded = await seedOperationalClinic();
    const service = createServiceClient();
    const other = await createPatient(service, seeded.doctor!.clinicId, {
      firstName: "Overlap",
      lastName: "Pacijent",
    });
    patientBId = other.id;
  });

  test.afterAll(async () => {
    if (seeded?.cleanupUsers) {
      await cleanupSeededUsers(seeded.cleanupUsers);
    }
  });

  test("doctor can create appointment; overlap is blocked", async ({
    page,
  }) => {
    const doctor = seeded.doctor!;
    const patientId = seeded.patientId!;
    const slot = wallClockTomorrow(10, 0);

    await loginAs(page, doctor.email, doctor.password);
    await page.goto("/bs/calendar");
    await expect(page.getByTestId("calendar-new-appointment")).toBeVisible();

    await page.getByTestId("calendar-new-appointment").click();
    await expect(page.getByTestId("appointment-patient")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("appointment-patient").selectOption(patientId);
    await page.locator("#startsLocal").fill(slot.startsLocal);
    await page.locator("#endsLocal").fill(slot.endsLocal);
    await page.getByRole("button", { name: "Kreiraj" }).click();

    await expect(page.getByRole("status")).toContainText("Termin je kreiran.", {
      timeout: 30_000,
    });

    await page.getByTestId("calendar-new-appointment").click();
    await expect(page.getByTestId("appointment-patient")).toBeVisible();
    await page.getByTestId("appointment-patient").selectOption(patientBId);
    await page.locator("#startsLocal").fill(slot.startsLocal);
    await page.locator("#endsLocal").fill(slot.endsLocal);
    await page.getByRole("button", { name: "Kreiraj" }).click();

    await expect(
      page.locator('[data-slot="field-error"]').filter({
        hasText: "Ovaj doktor već ima preklapajući termin.",
      }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
