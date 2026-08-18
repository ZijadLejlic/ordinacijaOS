import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P3.2 (docs/QA/Implementation-Plan.md): doctor calendar peer scope.
 * Closes `CAL-INT-004` + `RBAC-INT-005` / Threat-Model `T-RBAC-03` / BR-C06.
 *
 * **Mechanism (grepped, not assumed):**
 * - SA: `assertDoctorScope` in `lib/appointments/actions.ts` — if role is not
 *   manage-all (owner/assistant/reception via `canManageAllDoctors`) and
 *   `doctorId !== profile.id` → `{ error: "forbidden" }`. Used on create,
 *   update, reschedule, status, cancel, and waitlist book.
 * - RLS: `appointments_*` policies (`20260713230000_phase2c_appointments.sql`)
 *   require `can_manage_all_appointment_doctors() or doctor_id = auth.uid()`.
 *
 * **Important interaction:** peer UPDATE/SELECT via the SA path often returns
 * `appointmentNotFound` because RLS hides doctor B's row before
 * `assertDoctorScope` runs. Create-for-peer hits SA scope **before** insert —
 * that is the unambiguous SA deny. Direct PostgREST probes cover the RLS half.
 *
 * Pattern: P1.6/P1.7 SA (`vi.mock` Next + real actions) + P1.4 JWT→PostgREST.
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

import {
  createAppointmentAction,
  updateAppointmentStatusAction,
} from "@/lib/appointments/actions";

function slotForm(opts: {
  doctorId: string;
  patientId: string;
  dayOffset: number;
  hour: number;
}): FormData {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + opts.dayOffset);
  start.setUTCHours(opts.hour, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMinutes(30);
  const fd = new FormData();
  fd.set("doctorId", opts.doctorId);
  fd.set("patientId", opts.patientId);
  fd.set("locationId", "");
  fd.set("serviceId", "");
  fd.set("startsAt", start.toISOString());
  fd.set("endsAt", end.toISOString());
  fd.set("status", "confirmed");
  fd.set("notes", "");
  return fd;
}

describeSecurity("P3.2 doctor calendar peer scope (CAL-INT-004 / RBAC-INT-005)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let patientId: string;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let reception: TestUser;
  let owner: TestUser;
  let doctorAClient: DbClient;
  let doctorBClient: DbClient;
  let receptionClient: DbClient;
  let ownerClient: DbClient;
  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    // Two doctors in one clinic — byRole keeps only the last doctor, so
    // pick both from users[] by role order.
    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "doctor", "reception"],
      clinicName: `Cal Scope ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "cal-scope",
    });
    clinicId = clinic.clinicId;
    created.push(...clinic.users);

    const doctors = clinic.users.filter((u) => u.role === "doctor");
    if (doctors.length !== 2) {
      throw new Error(`expected 2 doctors, got ${doctors.length}`);
    }
    doctorA = doctors[0]!;
    doctorB = doctors[1]!;
    reception = clinic.byRole.reception!;
    owner = clinic.byRole.owner!;

    const patient = await createPatient(service, clinicId, {
      firstName: "Scope",
      lastName: `P${randomTag().slice(-6)}`,
    });
    patientId = patient.id;

    doctorAClient = await signInAs(url, anonKey, doctorA.email, doctorA.password);
    doctorBClient = await signInAs(url, anonKey, doctorB.email, doctorB.password);
    receptionClient = await signInAs(
      url,
      anonKey,
      reception.email,
      reception.password,
    );
    ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
  }, 90_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  it("CAL-INT-004 / RBAC-INT-005 SA: doctor A cannot create an appointment for doctor B", async () => {
    activeActionClient = doctorAClient;
    const result = await createAppointmentAction(
      null,
      slotForm({
        doctorId: doctorB.userId,
        patientId,
        dayOffset: 21,
        hour: 9,
      }),
    );
    expect(result?.error).toBe("forbidden");

    const { count } = await service
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorB.userId);
    expect(count ?? 0).toBe(0);
  });

  it("CAL-INT-004 SA positive: doctor A can create an appointment for self", async () => {
    activeActionClient = doctorAClient;
    const result = await createAppointmentAction(
      null,
      slotForm({
        doctorId: doctorA.userId,
        patientId,
        dayOffset: 22,
        hour: 9,
      }),
    );
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("appointmentCreated");

    const { data: rows } = await service
      .from("appointments")
      .select("id, doctor_id")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorA.userId);
    expect((rows ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("CAL-INT-004 SA: manage-all reception can create for doctor B", async () => {
    activeActionClient = receptionClient;
    const result = await createAppointmentAction(
      null,
      slotForm({
        doctorId: doctorB.userId,
        patientId,
        dayOffset: 23,
        hour: 10,
      }),
    );
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("appointmentCreated");
  });

  it("CAL-INT-004 SA: doctor A cannot mutate doctor B's appointment (RLS hides → notFound, or SA forbidden)", async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 24);
    start.setUTCHours(11, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMinutes(30);

    const { data: peerAppt, error } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctorB.userId,
        patient_id: patientId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmed",
        created_by: doctorB.userId,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(peerAppt?.id).toBeTruthy();

    activeActionClient = doctorAClient;
    const result = await updateAppointmentStatusAction(peerAppt!.id, "completed");
    // RLS SELECT filter → appointmentNotFound before assertDoctorScope; either
    // denial shape is acceptable so long as status does not change.
    expect(["appointmentNotFound", "forbidden"]).toContain(result?.error);

    const { data: still } = await service
      .from("appointments")
      .select("status")
      .eq("id", peerAppt!.id)
      .single();
    expect(still?.status).toBe("confirmed");
  });

  it("CAL-INT-004 RLS: doctor A PostgREST INSERT for doctor B is denied", async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 25);
    start.setUTCHours(12, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMinutes(30);

    const { error } = await doctorAClient.from("appointments").insert({
      clinic_id: clinicId,
      doctor_id: doctorB.userId,
      patient_id: patientId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "confirmed",
      created_by: doctorA.userId,
    });
    expect(error).not.toBeNull();
  });

  it("CAL-INT-004 RLS: doctor A cannot UPDATE doctor B's row (0 rows)", async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 26);
    start.setUTCHours(13, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMinutes(30);

    const { data: peerAppt, error: insertError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctorB.userId,
        patient_id: patientId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmed",
        created_by: doctorB.userId,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();

    const { data: updated, error } = await doctorAClient
      .from("appointments")
      .update({ notes: "peer hijack", updated_at: new Date().toISOString() })
      .eq("id", peerAppt!.id)
      .select("id");
    expect(error).toBeNull();
    expect(updated ?? []).toHaveLength(0);

    const { data: still } = await service
      .from("appointments")
      .select("notes")
      .eq("id", peerAppt!.id)
      .single();
    expect(still?.notes).toBeNull();
  });

  it("CAL-INT-004 RLS positive: doctor B can UPDATE own row", async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 27);
    start.setUTCHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMinutes(30);

    const { data: ownAppt, error: insertError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctorB.userId,
        patient_id: patientId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmed",
        created_by: doctorB.userId,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();

    const { data: updated, error } = await doctorBClient
      .from("appointments")
      .update({ notes: "own note", updated_at: new Date().toISOString() })
      .eq("id", ownAppt!.id)
      .select("id");
    expect(error).toBeNull();
    expect(updated ?? []).toHaveLength(1);
  });

  it("D56: owner without practices_as_doctor cannot book themselves", async () => {
    activeActionClient = ownerClient;
    const result = await createAppointmentAction(
      null,
      slotForm({
        doctorId: owner.userId,
        patientId,
        dayOffset: 28,
        hour: 8,
      }),
    );
    expect(result?.error).toBe("doctorNotFound");
  });

  it("D56: practicing owner can book themselves and still book another doctor", async () => {
    const { error: flagError } = await service
      .from("profiles")
      .update({ practices_as_doctor: true })
      .eq("id", owner.userId);
    expect(flagError).toBeNull();

    activeActionClient = ownerClient;
    const self = await createAppointmentAction(
      null,
      slotForm({
        doctorId: owner.userId,
        patientId,
        dayOffset: 29,
        hour: 8,
      }),
    );
    expect(self?.error).toBeUndefined();
    expect(self?.message).toBe("appointmentCreated");

    const forPeer = await createAppointmentAction(
      null,
      slotForm({
        doctorId: doctorA.userId,
        patientId,
        dayOffset: 29,
        hour: 10,
      }),
    );
    expect(forPeer?.error).toBeUndefined();
    expect(forPeer?.message).toBe("appointmentCreated");
  });
});
