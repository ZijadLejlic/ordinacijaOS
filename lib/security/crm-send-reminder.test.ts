import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
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
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";
import { ensureCrmNotifications } from "@/lib/crm/generate";

/**
 * P4.6 (docs/QA/Implementation-Plan.md): CRM send + email reminder INT.
 * Closes `CRM-INT-001`, `CRM-INT-002` / D23 / D24 / §12.1 email reminder.
 *
 * **Mechanism (grepped, not assumed):**
 * - Reminder: `updateEmailTemplateAction` (owner, feature `email_reminders`)
 *   → `sendAppointmentReminderAction` (owner/reception/**doctor own**, D52)
 *   inserts `outbound_messages` queued → `sendTemplatedEmail` → status sent +
 *   audit `email.reminder_sent`. Template key `appointment_reminder`.
 *   Doctor peer calendar → `forbidden`.
 * - CRM light: `ensureCrmNotifications` (`lib/crm/generate.ts`) only
 *   INSERTs `crm_notifications` with `status=open` — **never** calls
 *   Resend / outbound. Send is exclusively `sendCrmNotificationAction`
 *   (feature `crm_light`, Pro+). Generate unit window math = CRM-UNIT-002.
 *
 * Resend mocked — no outbound provider; assert DB/audit truth.
 * Pattern: P1.6 SA (`vi.mock` Next + real actions).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const MOCK_PROVIDER_ID = "mock-resend-crm-int";

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

vi.mock("@/lib/email/resend", () => ({
  sendTemplatedEmail: async () => ({ id: MOCK_PROVIDER_ID }),
}));

import {
  sendAppointmentReminderAction,
  updateEmailTemplateAction,
} from "@/lib/email/actions";
import { sendCrmNotificationAction } from "@/lib/crm/actions";

function birthdayInWindowYmd(daysAhead: number): string {
  const today = toZonedTime(new Date(), CLINIC_TIMEZONE);
  const due = addDays(today, daysAhead);
  // Stable past year so nextBirthdayDueOn lands on this anniversary.
  return `1990-${format(due, "MM-dd")}`;
}

describeSecurity("P4.6 CRM send + email reminder (CRM-INT-001/002)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let owner: TestUser;
  let reception: TestUser;
  let doctor: TestUser;
  let doctor2: TestUser;
  let ownerClient: DbClient;
  let receptionClient: DbClient;
  let doctorClient: DbClient;
  let doctor2Client: DbClient;
  let reminderPatientId: string;
  let crmPatientId: string;
  let appointmentId: string;
  let peerAppointmentId: string;
  let serviceId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "reception", "doctor"],
      clinicName: `CRM-INT-001 Reminder ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "crm-int-001",
    });
    clinicId = clinic.clinicId;
    created.push(...clinic.users);
    owner = clinic.byRole.owner!;
    reception = clinic.byRole.reception!;
    doctor = clinic.byRole.doctor!;

    const peer = await createClinicWithRoles(service, {
      roles: ["doctor"],
      clinicId,
      emailPrefix: "crm-int-001-peer",
    });
    created.push(...peer.users);
    doctor2 = peer.byRole.doctor!;

    ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    receptionClient = await signInAs(
      url,
      anonKey,
      reception.email,
      reception.password,
    );
    doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
    doctor2Client = await signInAs(
      url,
      anonKey,
      doctor2.email,
      doctor2.password,
    );

    const reminderPatient = await createPatient(service, clinicId, {
      firstName: "Reminder",
      lastName: `P${randomTag().slice(-6)}`,
    });
    reminderPatientId = reminderPatient.id;
    await service
      .from("patients")
      .update({ email: `reminder-${randomTag().slice(-6)}@ordinacijaos.test` })
      .eq("id", reminderPatientId);

    const crmPatient = await createPatient(service, clinicId, {
      firstName: "Crm",
      lastName: `P${randomTag().slice(-6)}`,
    });
    crmPatientId = crmPatient.id;
    await service
      .from("patients")
      .update({
        email: `crm-${randomTag().slice(-6)}@ordinacijaos.test`,
        date_of_birth: birthdayInWindowYmd(2),
      })
      .eq("id", crmPatientId);

    const svc = await createServiceRow(service, clinicId);
    serviceId = svc.id;

    const startsAt = new Date();
    startsAt.setUTCDate(startsAt.getUTCDate() + 3);
    startsAt.setUTCHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setUTCMinutes(30);

    const { data: appt, error: apptError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        patient_id: reminderPatientId,
        doctor_id: doctor.userId,
        service_id: serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        created_by: owner.userId,
      })
      .select("id")
      .single();
    if (apptError || !appt) {
      throw new Error(apptError?.message ?? "appointment insert failed");
    }
    appointmentId = appt.id;

    const peerStarts = new Date(startsAt);
    peerStarts.setUTCHours(14, 0, 0, 0);
    const peerEnds = new Date(peerStarts);
    peerEnds.setUTCMinutes(30);
    const { data: peerAppt, error: peerError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        patient_id: reminderPatientId,
        doctor_id: doctor2.userId,
        service_id: serviceId,
        starts_at: peerStarts.toISOString(),
        ends_at: peerEnds.toISOString(),
        status: "confirmed",
        created_by: owner.userId,
      })
      .select("id")
      .single();
    if (peerError || !peerAppt) {
      throw new Error(peerError?.message ?? "peer appointment insert failed");
    }
    peerAppointmentId = peerAppt.id;
  }, 120_000);

  afterAll(async () => {
    if (service && created.length > 0) {
      await cleanupClinics(service, created);
    }
  }, 120_000);

  it("CRM-INT-001: owner edits reminder template + send → outbound_messages sent", async () => {
    activeActionClient = ownerClient;

    const customSubject = `Podsjetnik CRM-INT-001 ${randomTag().slice(-6)}`;
    const customBody =
      "Poštovani/a {{ime}}, termin {{datum}} u {{vrijeme}} kod {{doktor}}.";

    const fd = new FormData();
    fd.set("templateKey", "appointment_reminder");
    fd.set("locale", "bs");
    fd.set("subject", customSubject);
    fd.set("bodyText", customBody);
    const saved = await updateEmailTemplateAction(null, fd);
    expect(saved?.message).toBe("saved");

    const { data: template } = await service
      .from("email_templates")
      .select("subject, body_text")
      .eq("clinic_id", clinicId)
      .eq("template_key", "appointment_reminder")
      .eq("locale", "bs")
      .single();
    expect(template?.subject).toBe(customSubject);
    expect(template?.body_text).toBe(customBody);

    // Reception can send reminders (owner wrote template).
    activeActionClient = receptionClient;
    const sent = await sendAppointmentReminderAction(appointmentId, "bs");
    expect(sent?.message).toBe("reminderSent");

    const { data: outbound } = await service
      .from("outbound_messages")
      .select(
        "id, template_key, status, to_address, subject, provider_message_id, appointment_id, is_test",
      )
      .eq("clinic_id", clinicId)
      .eq("appointment_id", appointmentId)
      .eq("template_key", "appointment_reminder")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(outbound?.status).toBe("sent");
    expect(outbound?.is_test).toBe(false);
    expect(outbound?.provider_message_id).toBe(MOCK_PROVIDER_ID);
    expect(outbound?.subject).toBe(customSubject);
    expect(outbound?.to_address).toContain("@ordinacijaos.test");

    const { data: audits } = await service
      .from("audit_events")
      .select("event_name, payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "email.reminder_sent");
    expect(
      (audits ?? []).some((a) => {
        const p = a.payload_json as { outbound_id?: string };
        return p?.outbound_id === outbound?.id;
      }),
    ).toBe(true);
  }, 60_000);

  it("CRM-INT-001b: doctor sends own appointment reminder; peer forbidden (D52)", async () => {
    activeActionClient = doctorClient;
    const own = await sendAppointmentReminderAction(appointmentId, "bs");
    expect(own?.message).toBe("reminderSent");

    const { data: outbound } = await service
      .from("outbound_messages")
      .select("id, status, sent_by, appointment_id")
      .eq("clinic_id", clinicId)
      .eq("appointment_id", appointmentId)
      .eq("sent_by", doctor.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(outbound?.status).toBe("sent");

    activeActionClient = doctorClient;
    const peer = await sendAppointmentReminderAction(peerAppointmentId, "bs");
    // Doctor RLS hides peer appointments → notFound before SA scope check.
    expect(peer?.error).toBe("appointmentNotFound");

    activeActionClient = doctor2Client;
    const peerOwn = await sendAppointmentReminderAction(
      peerAppointmentId,
      "bs",
    );
    expect(peerOwn?.message).toBe("reminderSent");
  }, 60_000);

  it("CRM-INT-002: generate inserts open only; send only via sendCrmNotificationAction", async () => {
    // Generate as reception JWT (same client loadCrm uses) — no Resend.
    const { inserted } = await ensureCrmNotifications(
      receptionClient,
      clinicId,
    );
    expect(inserted).toBeGreaterThanOrEqual(1);

    const { data: openRows } = await service
      .from("crm_notifications")
      .select("id, status, kind, patient_id, outbound_message_id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", crmPatientId)
      .eq("kind", "birthday")
      .eq("status", "open");

    expect(openRows?.length).toBeGreaterThanOrEqual(1);
    const notification = openRows![0]!;
    expect(notification.outbound_message_id).toBeNull();

    const { count: outboundBefore } = await service
      .from("outbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", crmPatientId)
      .eq("template_key", "birthday");
    expect(outboundBefore ?? 0).toBe(0);

    // Human send path.
    activeActionClient = receptionClient;
    const sendResult = await sendCrmNotificationAction(notification.id, "bs");
    expect(sendResult?.message).toBe("sent");

    const { data: after } = await service
      .from("crm_notifications")
      .select("status, outbound_message_id, sent_by")
      .eq("id", notification.id)
      .single();
    expect(after?.status).toBe("sent");
    expect(after?.outbound_message_id).toBeTruthy();
    expect(after?.sent_by).toBe(reception.userId);

    const { data: outbound } = await service
      .from("outbound_messages")
      .select("id, status, template_key, provider_message_id, is_test")
      .eq("id", after!.outbound_message_id!)
      .single();
    expect(outbound?.status).toBe("sent");
    expect(outbound?.template_key).toBe("birthday");
    expect(outbound?.provider_message_id).toBe(MOCK_PROVIDER_ID);
    expect(outbound?.is_test).toBe(false);

    // Re-generate must not auto-send or duplicate open row for same due.
    const again = await ensureCrmNotifications(receptionClient, clinicId);
    expect(again.inserted).toBe(0);

    const { data: stillSent } = await service
      .from("crm_notifications")
      .select("status")
      .eq("id", notification.id)
      .single();
    expect(stillSent?.status).toBe("sent");

    const { count: birthdayOutbound } = await service
      .from("outbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", crmPatientId)
      .eq("template_key", "birthday");
    expect(birthdayOutbound ?? 0).toBe(1);
  }, 60_000);
});
