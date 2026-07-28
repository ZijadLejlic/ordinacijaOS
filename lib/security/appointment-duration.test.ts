import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createServiceRow,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P6a — CAL-INT-001 (D15): appointment default duration from service.
 *
 * **Mechanism (read, not invented):**
 * UI (`components/calendar/appointment-form.tsx` `onServiceChange`) sets
 * `endsLocal = start + service.durationMinutes`. SA
 * `createAppointmentAction` persists client `startsAt`/`endsAt` (no
 * server-side recompute). Default service duration in factory / forms is 30m.
 *
 * INT: create a 30m service → SA create with endsAt = start+30m → assert
 * stored `ends_at` matches (duration contract end-to-end).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeActionClient,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "bs",
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

import { createAppointmentAction } from "@/lib/appointments/actions";

describeSecurity("appointment service duration (CAL-INT-001)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let reception: TestUser;
  let doctor: TestUser;
  let patientId: string;
  let serviceId: string;
  let durationMinutes: number;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["reception", "doctor"],
      clinicName: `CAL-INT-001 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "cal-int-001",
    });
    reception = clinic.byRole.reception!;
    doctor = clinic.byRole.doctor!;
    created.push(...clinic.users);

    const patient = await createPatient(service, clinic.clinicId);
    patientId = patient.id;

    const svc = await createServiceRow(service, clinic.clinicId);
    serviceId = svc.id;
    durationMinutes = svc.duration_minutes;
    expect(durationMinutes).toBe(30);
  }, 60_000);

  afterAll(async () => {
    if (!service || created.length === 0) return;
    await cleanupClinics(service, created);
  });

  it("create with 30m service duration stores ends_at = start+30m", async () => {
    activeActionClient = await signInAs(
      url,
      anonKey,
      reception.email,
      reception.password,
    );

    const startsAt = new Date("2026-08-15T09:00:00.000Z");
    const endsAt = new Date(
      startsAt.getTime() + durationMinutes * 60_000,
    );

    const fd = new FormData();
    fd.set("doctorId", doctor.userId);
    fd.set("patientId", patientId);
    fd.set("serviceId", serviceId);
    fd.set("startsAt", startsAt.toISOString());
    fd.set("endsAt", endsAt.toISOString());
    fd.set("status", "confirmed");
    fd.set("notes", "");

    const result = await createAppointmentAction(null, fd);
    expect(result).toEqual({ message: "appointmentCreated" });

    const { data: row, error } = await service
      .from("appointments")
      .select("starts_at, ends_at, service_id")
      .eq("clinic_id", reception.clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(row!.service_id).toBe(serviceId);
    expect(new Date(row!.starts_at).toISOString()).toBe(startsAt.toISOString());
    expect(new Date(row!.ends_at).toISOString()).toBe(endsAt.toISOString());
    expect(
      (new Date(row!.ends_at).getTime() - new Date(row!.starts_at).getTime()) /
        60_000,
    ).toBe(30);
  }, 60_000);
});
