import { test, expect, type Page } from "@playwright/test";
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

/** Drive the custom AppointmentDateTimeField picker (button + panel). */
async function fillDateTimeField(
  page: Page,
  fieldId: "startsLocal" | "endsLocal",
  localValue: string,
) {
  const [datePart, timePart] = localValue.split("T");
  if (!datePart || !timePart) {
    throw new Error(`invalid local datetime: ${localValue}`);
  }
  const targetMonth = datePart.slice(0, 7); // yyyy-MM

  await page.locator(`#${fieldId}`).click();
  const panel = page.locator(`#${fieldId}-panel`);
  await expect(panel).toBeVisible();

  for (let i = 0; i < 14; i++) {
    const month = await panel.getByTestId(`${fieldId}-month`).getAttribute("data-month");
    if (month === targetMonth) break;
    if (month && month < targetMonth) {
      await panel.getByTestId(`${fieldId}-next-month`).click();
    } else {
      await panel.getByTestId(`${fieldId}-prev-month`).click();
    }
  }

  await expect(panel.getByTestId(`${fieldId}-month`)).toHaveAttribute(
    "data-month",
    targetMonth,
  );
  await panel.locator(`[data-testid="${fieldId}-day"][data-date="${datePart}"]`).click();
  await panel.locator(`[data-testid="${fieldId}-time"][data-time="${timePart}"]`).click();
  await panel.getByRole("button", { name: "Gotovo" }).click();
  await expect(panel).toBeHidden();
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
    await fillDateTimeField(page, "startsLocal", slot.startsLocal);
    await fillDateTimeField(page, "endsLocal", slot.endsLocal);
    await page.getByRole("button", { name: "Kreiraj" }).click();

    await expect(page.getByRole("status")).toContainText("Termin je kreiran.", {
      timeout: 30_000,
    });

    await page.getByTestId("calendar-new-appointment").click();
    await expect(page.getByTestId("appointment-patient")).toBeVisible();
    await page.getByTestId("appointment-patient").selectOption(patientBId);
    await fillDateTimeField(page, "startsLocal", slot.startsLocal);
    await fillDateTimeField(page, "endsLocal", slot.endsLocal);
    await page.getByRole("button", { name: "Kreiraj" }).click();

    await expect(
      page.locator('[data-slot="field-error"]').filter({
        hasText: "Ovaj doktor već ima preklapajući termin.",
      }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
