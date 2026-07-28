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
 * P4.3 (docs/QA/Implementation-Plan.md): waitlist auto-propose on cancel.
 * Closes `CAL-INT-003` / D25 / BR-C08 / Journey J3 waitlist half / §6.6.
 *
 * **Mechanism (grepped, not assumed):**
 * - `cancelAppointmentAction` (`lib/appointments/actions.ts`) sets status
 *   cancelled, then — only if `canWriteWaitlist(role)` (owner/reception) AND
 *   `clinicHasFeature(..., "waitlist_auto")` — loads `appointment_waitlist`
 *   rows with `status = waiting`, runs `matchWaitlistForCancelledSlot`, returns
 *   `waitlistSuggestions`, and audits `waitlist.auto_suggested` when matches > 0.
 * - Product does **not** flip waitlist status to `offered` or send outbound
 *   email on cancel; UI shows suggestions (`calendar-shell` → `WaitlistPanel`).
 *   Booking is a separate SA (`bookWaitlistOfferAction`).
 * - `updateAppointmentStatusAction(..., "cancelled")` delegates to cancel.
 * - Match algorithm itself = `CAL-UNIT-001` (not re-proven here). Feature deny
 *   = `PLAN-INT-011`. Doctor peer scope = `CAL-INT-004` / `RBAC-INT-005`.
 *
 * Pattern: P1.6 SA (`vi.mock` Next + real actions + `createClinicWithRoles`).
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
  cancelAppointmentAction,
  updateAppointmentStatusAction,
} from "@/lib/appointments/actions";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function slotBounds(dayOffset: number, hour: number): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
  startsAt.setUTCHours(hour, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setUTCMinutes(30);
  return { startsAt, endsAt };
}

describeSecurity("P4.3 waitlist on cancel (CAL-INT-003)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let doctor: TestUser;
  let reception: TestUser;
  let receptionClient: DbClient;
  let doctorClient: DbClient;
  let bookedPatientId: string;
  let waitPatientId: string;
  let wrongDocPatientId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "reception"],
      clinicName: `CAL-INT-003 Waitlist ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "cal-int-003",
    });
    clinicId = clinic.clinicId;
    created.push(...clinic.users);
    doctor = clinic.byRole.doctor!;
    reception = clinic.byRole.reception!;

    const booked = await createPatient(service, clinicId, {
      firstName: "Booked",
      lastName: `P${randomTag().slice(-6)}`,
    });
    const wait = await createPatient(service, clinicId, {
      firstName: "Wait",
      lastName: `P${randomTag().slice(-6)}`,
    });
    const wrongDoc = await createPatient(service, clinicId, {
      firstName: "WrongDoc",
      lastName: `P${randomTag().slice(-6)}`,
    });
    bookedPatientId = booked.id;
    waitPatientId = wait.id;
    wrongDocPatientId = wrongDoc.id;

    receptionClient = await signInAs(
      url,
      anonKey,
      reception.email,
      reception.password,
    );
    doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
  }, 90_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  it("CAL-INT-003: reception cancel with matching waitlist returns suggestions + audit", async () => {
    const { startsAt, endsAt } = slotBounds(30, 9);
    const day = utcDay(startsAt);

    const { data: appt, error: apptError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctor.userId,
        patient_id: bookedPatientId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        created_by: reception.userId,
      })
      .select("id")
      .single();
    expect(apptError).toBeNull();
    expect(appt?.id).toBeTruthy();

    const { data: matchRow, error: waitError } = await service
      .from("appointment_waitlist")
      .insert({
        clinic_id: clinicId,
        patient_id: waitPatientId,
        doctor_id: doctor.userId,
        preferred_from: day,
        preferred_to: day,
        status: "waiting",
        priority: 1,
        created_by: reception.userId,
        notes: "cal-int-003-match",
      })
      .select("id")
      .single();
    expect(waitError).toBeNull();
    expect(matchRow?.id).toBeTruthy();

    // Non-match: same clinic, preferred doctor ≠ freed slot doctor.
    const owner = created.find((u) => u.role === "owner")!;
    const { data: wrongDocRow, error: wrongDocError } = await service
      .from("appointment_waitlist")
      .insert({
        clinic_id: clinicId,
        patient_id: wrongDocPatientId,
        doctor_id: owner.userId,
        preferred_from: day,
        preferred_to: day,
        status: "waiting",
        priority: 5,
        created_by: reception.userId,
        notes: "cal-int-003-wrong-doc",
      })
      .select("id")
      .single();
    expect(wrongDocError).toBeNull();

    activeActionClient = receptionClient;
    const result = await cancelAppointmentAction(appt!.id);

    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("appointmentCancelled");
    expect(result?.waitlistSuggestions?.length).toBeGreaterThanOrEqual(1);
    expect(result?.waitlistSuggestions?.map((s) => s.id)).toContain(
      matchRow!.id,
    );
    expect(result?.waitlistSuggestions?.map((s) => s.id)).not.toContain(
      wrongDocRow!.id,
    );
    const suggestion = result!.waitlistSuggestions!.find(
      (s) => s.id === matchRow!.id,
    );
    expect(suggestion?.patientId).toBe(waitPatientId);

    const { data: cancelled } = await service
      .from("appointments")
      .select("status")
      .eq("id", appt!.id)
      .single();
    expect(cancelled?.status).toBe("cancelled");

    // Product truth: suggest only — status stays waiting (no auto-offer).
    const { data: waitAfter } = await service
      .from("appointment_waitlist")
      .select("status, offered_appointment_id")
      .eq("id", matchRow!.id)
      .single();
    expect(waitAfter?.status).toBe("waiting");
    expect(waitAfter?.offered_appointment_id).toBeNull();

    const { data: audits } = await service
      .from("audit_events")
      .select("event_name, actor_user_id, payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "waitlist.auto_suggested")
      .order("created_at", { ascending: false })
      .limit(5);

    const hit = (audits ?? []).find((row) => {
      const payload = row.payload_json;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
      }
      const ids = payload.waitlist_ids;
      return (
        row.actor_user_id === reception.userId &&
        payload.appointment_id === appt!.id &&
        Array.isArray(ids) &&
        ids.includes(matchRow!.id)
      );
    });
    expect(hit).toBeTruthy();
  });

  it("CAL-INT-003: doctor cancel frees slot but does not propose waitlist (no canWriteWaitlist)", async () => {
    const { startsAt, endsAt } = slotBounds(31, 10);
    const day = utcDay(startsAt);

    const { data: appt, error: apptError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctor.userId,
        patient_id: bookedPatientId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        created_by: doctor.userId,
      })
      .select("id")
      .single();
    expect(apptError).toBeNull();

    const { data: waitRow } = await service
      .from("appointment_waitlist")
      .insert({
        clinic_id: clinicId,
        patient_id: waitPatientId,
        doctor_id: doctor.userId,
        preferred_from: day,
        preferred_to: day,
        status: "waiting",
        priority: 2,
        created_by: reception.userId,
        notes: "cal-int-003-doctor-cancel",
      })
      .select("id")
      .single();

    activeActionClient = doctorClient;
    const result = await cancelAppointmentAction(appt!.id);

    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("appointmentCancelled");
    expect(result?.waitlistSuggestions).toBeUndefined();

    const { data: cancelled } = await service
      .from("appointments")
      .select("status")
      .eq("id", appt!.id)
      .single();
    expect(cancelled?.status).toBe("cancelled");

    const { data: audits } = await service
      .from("audit_events")
      .select("payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "waitlist.auto_suggested")
      .order("created_at", { ascending: false })
      .limit(10);

    const leaked = (audits ?? []).some((row) => {
      const payload = row.payload_json;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
      }
      return payload.appointment_id === appt!.id;
    });
    expect(leaked).toBe(false);

    // Waitlist row untouched.
    const { data: waitAfter } = await service
      .from("appointment_waitlist")
      .select("status")
      .eq("id", waitRow!.id)
      .single();
    expect(waitAfter?.status).toBe("waiting");
  });

  it("CAL-INT-003: status→cancelled delegates to cancel propose path", async () => {
    const { startsAt, endsAt } = slotBounds(32, 11);
    const day = utcDay(startsAt);

    const { data: appt } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctor.userId,
        patient_id: bookedPatientId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        created_by: reception.userId,
      })
      .select("id")
      .single();

    const { data: matchRow } = await service
      .from("appointment_waitlist")
      .insert({
        clinic_id: clinicId,
        patient_id: waitPatientId,
        doctor_id: null,
        preferred_from: day,
        preferred_to: day,
        status: "waiting",
        priority: 0,
        created_by: reception.userId,
        notes: "cal-int-003-status-path",
      })
      .select("id")
      .single();

    activeActionClient = receptionClient;
    const result = await updateAppointmentStatusAction(appt!.id, "cancelled");

    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("appointmentCancelled");
    expect(result?.waitlistSuggestions?.map((s) => s.id)).toContain(
      matchRow!.id,
    );
  });

  it("CAL-INT-003: reception cancel with no matching wait returns empty suggestions", async () => {
    const { startsAt, endsAt } = slotBounds(33, 12);

    const { data: appt } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: doctor.userId,
        patient_id: bookedPatientId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        created_by: reception.userId,
      })
      .select("id")
      .single();

    // Only out-of-window waitlist exists.
    await service.from("appointment_waitlist").insert({
      clinic_id: clinicId,
      patient_id: waitPatientId,
      doctor_id: doctor.userId,
      preferred_from: "2099-01-01",
      preferred_to: "2099-01-31",
      status: "waiting",
      priority: 9,
      created_by: reception.userId,
      notes: "cal-int-003-out-of-window",
    });

    activeActionClient = receptionClient;
    const result = await cancelAppointmentAction(appt!.id);

    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("appointmentCancelled");
    expect(result?.waitlistSuggestions ?? []).toEqual([]);

    const { data: audits } = await service
      .from("audit_events")
      .select("payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "waitlist.auto_suggested")
      .order("created_at", { ascending: false })
      .limit(10);

    const leaked = (audits ?? []).some((row) => {
      const payload = row.payload_json;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
      }
      return payload.appointment_id === appt!.id;
    });
    expect(leaked).toBe(false);
  });
});
