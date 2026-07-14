"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { isAppointmentOverlapError } from "@/lib/appointments/overlap";
import {
  matchWaitlistForCancelledSlot,
  type WaitlistMatchRow,
} from "@/lib/appointments/waitlist";
import {
  canManageAllDoctors,
  canWriteCalendar,
  canWriteWaitlist,
} from "@/lib/calendar/rbac";
import { getClinicWriteBlock } from "@/lib/clinic/writable";
import { assertFeature, clinicHasFeature } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  addWaitlistSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
} from "@/lib/validations/appointment";

export type AppointmentActionState = {
  error?: string;
  message?: string;
  waitlistSuggestions?: WaitlistSuggestion[];
} | null;

export type WaitlistSuggestion = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string | null;
  serviceId: string | null;
  locationId: string | null;
  preferredFrom: string | null;
  preferredTo: string | null;
};

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Parameters<typeof canWriteCalendar>[0];
  is_active: boolean;
};

async function requireCalendarWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null as ProfileRow | null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canWriteCalendar(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
  if (writeBlock) {
    return { error: writeBlock, supabase, user, profile: profile as ProfileRow };
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

async function requireWaitlistWriter() {
  const auth = await requireCalendarWriter();
  if (auth.error || !auth.profile) return auth;
  if (!canWriteWaitlist(auth.profile.role)) {
    return {
      error: "forbidden" as const,
      supabase: auth.supabase,
      user: auth.user,
      profile: null,
    };
  }
  return auth;
}

function revalidateCalendar(locale: string) {
  revalidatePath(`/${locale}/calendar`);
  revalidatePath(`/${locale}/dashboard`);
}

function assertDoctorScope(
  profile: ProfileRow,
  doctorId: string,
): string | null {
  if (!canManageAllDoctors(profile.role) && doctorId !== profile.id) {
    return "forbidden";
  }
  return null;
}

async function requireActivePatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string,
) {
  const { data: patient } = await supabase
    .from("patients")
    .select("id, is_active")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "patientNotFound" as const };
  if (!patient.is_active) return { error: "patientInactive" as const };
  return { error: null, patient };
}

async function requireActiveDoctor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  doctorId: string,
) {
  const { data: doctor } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", doctorId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!doctor || doctor.role !== "doctor" || !doctor.is_active) {
    return { error: "doctorNotFound" as const };
  }
  return { error: null, doctor };
}

function endsAfterStarts(startsAt: string, endsAt: string): boolean {
  return new Date(endsAt).getTime() > new Date(startsAt).getTime();
}

export async function createAppointmentAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const parsed = createAppointmentSchema.safeParse({
    doctorId: formData.get("doctorId"),
    patientId: formData.get("patientId"),
    locationId: formData.get("locationId") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status") || "confirmed",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { error: "invalid" };
  if (!endsAfterStarts(parsed.data.startsAt, parsed.data.endsAt)) {
    return { error: "invalid" };
  }

  const auth = await requireCalendarWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "calendar_basic",
  );
  if (!feature.ok) return { error: feature.code };

  const scopeError = assertDoctorScope(profile, parsed.data.doctorId);
  if (scopeError) return { error: scopeError };

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    parsed.data.patientId,
  );
  if (patientCheck.error) return { error: patientCheck.error };

  const doctorCheck = await requireActiveDoctor(
    supabase,
    profile.clinic_id,
    parsed.data.doctorId,
  );
  if (doctorCheck.error) return { error: doctorCheck.error };

  const { data: row, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: profile.clinic_id,
      doctor_id: parsed.data.doctorId,
      patient_id: parsed.data.patientId,
      location_id: parsed.data.locationId,
      service_id: parsed.data.serviceId,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error) {
    if (isAppointmentOverlapError(error)) return { error: "appointmentOverlap" };
    return { error: "createFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "appointment.created",
    payload: {
      appointment_id: row.id,
      doctor_id: parsed.data.doctorId,
      patient_id: parsed.data.patientId,
      status: parsed.data.status,
    },
  });

  revalidateCalendar(locale);
  return { message: "appointmentCreated" };
}

export async function updateAppointmentAction(
  appointmentId: string,
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const parsed = updateAppointmentSchema.safeParse({
    doctorId: formData.get("doctorId"),
    patientId: formData.get("patientId"),
    locationId: formData.get("locationId") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { error: "invalid" };
  if (!endsAfterStarts(parsed.data.startsAt, parsed.data.endsAt)) {
    return { error: "invalid" };
  }

  const auth = await requireCalendarWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "calendar_basic",
  );
  if (!feature.ok) return { error: feature.code };

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, doctor_id, patient_id, status")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "appointmentNotFound" };

  const scopeError = assertDoctorScope(profile, existing.doctor_id);
  if (scopeError) return { error: scopeError };
  const newScope = assertDoctorScope(profile, parsed.data.doctorId);
  if (newScope) return { error: newScope };

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    parsed.data.patientId,
  );
  if (patientCheck.error) return { error: patientCheck.error };

  const doctorCheck = await requireActiveDoctor(
    supabase,
    profile.clinic_id,
    parsed.data.doctorId,
  );
  if (doctorCheck.error) return { error: doctorCheck.error };

  const { error } = await supabase
    .from("appointments")
    .update({
      doctor_id: parsed.data.doctorId,
      patient_id: parsed.data.patientId,
      location_id: parsed.data.locationId,
      service_id: parsed.data.serviceId,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    if (isAppointmentOverlapError(error)) return { error: "appointmentOverlap" };
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "appointment.updated",
    payload: {
      appointment_id: appointmentId,
      doctor_id: parsed.data.doctorId,
      patient_id: parsed.data.patientId,
      status: parsed.data.status,
    },
  });

  revalidateCalendar(locale);
  return { message: "appointmentUpdated" };
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  startsAt: string,
  endsAt: string,
): Promise<AppointmentActionState> {
  const parsed = rescheduleAppointmentSchema.safeParse({ startsAt, endsAt });
  if (!parsed.success) return { error: "invalid" };
  if (!endsAfterStarts(parsed.data.startsAt, parsed.data.endsAt)) {
    return { error: "invalid" };
  }

  const auth = await requireCalendarWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const basic = await assertFeature(supabase, profile.clinic_id, "calendar_basic");
  if (!basic.ok) return { error: basic.code };

  const advanced = await assertFeature(
    supabase,
    profile.clinic_id,
    "calendar_advanced",
  );
  if (!advanced.ok) return { error: advanced.code };

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, doctor_id, status")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "appointmentNotFound" };
  if (existing.status === "cancelled" || existing.status === "no_show") {
    return { error: "invalid" };
  }

  const scopeError = assertDoctorScope(profile, existing.doctor_id);
  if (scopeError) return { error: scopeError };

  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    if (isAppointmentOverlapError(error)) return { error: "appointmentOverlap" };
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "appointment.rescheduled",
    payload: {
      appointment_id: appointmentId,
      doctor_id: existing.doctor_id,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
    },
  });

  revalidateCalendar(locale);
  return { message: "appointmentRescheduled" };
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: string,
): Promise<AppointmentActionState> {
  const parsed = updateAppointmentStatusSchema.safeParse({ status });
  if (!parsed.success) return { error: "invalid" };

  if (parsed.data.status === "cancelled") {
    return cancelAppointmentAction(appointmentId);
  }

  const auth = await requireCalendarWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "calendar_basic",
  );
  if (!feature.ok) return { error: feature.code };

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, doctor_id, status")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "appointmentNotFound" };

  const scopeError = assertDoctorScope(profile, existing.doctor_id);
  if (scopeError) return { error: scopeError };

  const { error } = await supabase
    .from("appointments")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    if (isAppointmentOverlapError(error)) return { error: "appointmentOverlap" };
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "appointment.status_changed",
    payload: {
      appointment_id: appointmentId,
      from: existing.status,
      to: parsed.data.status,
    },
  });

  revalidateCalendar(locale);
  return { message: "appointmentUpdated" };
}

export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<AppointmentActionState> {
  const auth = await requireCalendarWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "calendar_basic",
  );
  if (!feature.ok) return { error: feature.code };

  const { data: existing } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_id, service_id, location_id, starts_at, status",
    )
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "appointmentNotFound" };
  if (existing.status === "cancelled") {
    return { message: "appointmentCancelled" };
  }

  const scopeError = assertDoctorScope(profile, existing.doctor_id);
  if (scopeError) return { error: scopeError };

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "appointment.cancelled",
    payload: {
      appointment_id: appointmentId,
      doctor_id: existing.doctor_id,
      patient_id: existing.patient_id,
    },
  });

  let waitlistSuggestions: WaitlistSuggestion[] | undefined;

  const hasWaitlist =
    canWriteWaitlist(profile.role) &&
    (await clinicHasFeature(supabase, profile.clinic_id, "waitlist_auto"));

  if (hasWaitlist) {
    const { data: waitRows } = await supabase
      .from("appointment_waitlist")
      .select(
        "id, patient_id, doctor_id, service_id, location_id, preferred_from, preferred_to, status, priority, created_at, patients(first_name, last_name)",
      )
      .eq("clinic_id", profile.clinic_id)
      .eq("status", "waiting")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);

    const mapped: WaitlistMatchRow[] = (waitRows ?? []).map((row) => {
      const patient = Array.isArray(row.patients)
        ? row.patients[0]
        : row.patients;
      return {
        id: row.id,
        patient_id: row.patient_id,
        doctor_id: row.doctor_id,
        service_id: row.service_id,
        location_id: row.location_id,
        preferred_from: row.preferred_from,
        preferred_to: row.preferred_to,
        status: row.status,
        priority: row.priority,
        created_at: row.created_at,
        patient_first_name: patient?.first_name ?? null,
        patient_last_name: patient?.last_name ?? null,
      };
    });

    const matches = matchWaitlistForCancelledSlot(mapped, {
      doctorId: existing.doctor_id,
      serviceId: existing.service_id,
      locationId: existing.location_id,
      startsAt: new Date(existing.starts_at),
    });

    waitlistSuggestions = matches.map((m) => ({
      id: m.id,
      patientId: m.patient_id,
      patientName: [m.patient_first_name, m.patient_last_name]
        .filter(Boolean)
        .join(" "),
      doctorId: m.doctor_id,
      serviceId: m.service_id,
      locationId: m.location_id,
      preferredFrom: m.preferred_from,
      preferredTo: m.preferred_to,
    }));

    if (matches.length > 0) {
      await writeAuditEvent(supabase, {
        clinicId: profile.clinic_id,
        actorUserId: user!.id,
        eventName: "waitlist.auto_suggested",
        payload: {
          appointment_id: appointmentId,
          waitlist_ids: matches.map((m) => m.id),
        },
      });
    }
  }

  revalidateCalendar(locale);
  return { message: "appointmentCancelled", waitlistSuggestions };
}

export async function addWaitlistAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const parsed = addWaitlistSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    locationId: formData.get("locationId") ?? "",
    preferredFrom: formData.get("preferredFrom") ?? "",
    preferredTo: formData.get("preferredTo") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { error: "invalid" };

  const auth = await requireWaitlistWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "waitlist_auto",
  );
  if (!feature.ok) return { error: feature.code };

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    parsed.data.patientId,
  );
  if (patientCheck.error) return { error: patientCheck.error };

  if (
    parsed.data.preferredFrom &&
    parsed.data.preferredTo &&
    parsed.data.preferredTo < parsed.data.preferredFrom
  ) {
    return { error: "invalid" };
  }

  const { data: row, error } = await supabase
    .from("appointment_waitlist")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: parsed.data.patientId,
      doctor_id: parsed.data.doctorId,
      service_id: parsed.data.serviceId,
      location_id: parsed.data.locationId,
      preferred_from: parsed.data.preferredFrom,
      preferred_to: parsed.data.preferredTo,
      notes: parsed.data.notes || null,
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error) return { error: "createFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "waitlist.added",
    payload: {
      waitlist_id: row.id,
      patient_id: parsed.data.patientId,
    },
  });

  revalidateCalendar(locale);
  return { message: "waitlistAdded" };
}

export async function cancelWaitlistAction(
  waitlistId: string,
): Promise<AppointmentActionState> {
  const auth = await requireWaitlistWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "waitlist_auto",
  );
  if (!feature.ok) return { error: feature.code };

  const { data: existing } = await supabase
    .from("appointment_waitlist")
    .select("id, status")
    .eq("id", waitlistId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "waitlistNotFound" };

  const { error } = await supabase
    .from("appointment_waitlist")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", waitlistId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "waitlist.cancelled",
    payload: { waitlist_id: waitlistId },
  });

  revalidateCalendar(locale);
  return { message: "waitlistCancelled" };
}

export async function bookWaitlistOfferAction(
  waitlistId: string,
  formData: FormData,
): Promise<AppointmentActionState> {
  const parsed = createAppointmentSchema.safeParse({
    doctorId: formData.get("doctorId"),
    patientId: formData.get("patientId"),
    locationId: formData.get("locationId") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status") || "confirmed",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { error: "invalid" };
  if (!endsAfterStarts(parsed.data.startsAt, parsed.data.endsAt)) {
    return { error: "invalid" };
  }

  const auth = await requireWaitlistWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const waitlistFeature = await assertFeature(
    supabase,
    profile.clinic_id,
    "waitlist_auto",
  );
  if (!waitlistFeature.ok) return { error: waitlistFeature.code };

  const calendarFeature = await assertFeature(
    supabase,
    profile.clinic_id,
    "calendar_basic",
  );
  if (!calendarFeature.ok) return { error: calendarFeature.code };

  const { data: waitRow } = await supabase
    .from("appointment_waitlist")
    .select("id, patient_id, status")
    .eq("id", waitlistId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!waitRow || waitRow.status !== "waiting") {
    return { error: "waitlistNotFound" };
  }

  if (waitRow.patient_id !== parsed.data.patientId) {
    return { error: "invalid" };
  }

  const scopeError = assertDoctorScope(profile, parsed.data.doctorId);
  if (scopeError) return { error: scopeError };

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    parsed.data.patientId,
  );
  if (patientCheck.error) return { error: patientCheck.error };

  const doctorCheck = await requireActiveDoctor(
    supabase,
    profile.clinic_id,
    parsed.data.doctorId,
  );
  if (doctorCheck.error) return { error: doctorCheck.error };

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: profile.clinic_id,
      doctor_id: parsed.data.doctorId,
      patient_id: parsed.data.patientId,
      location_id: parsed.data.locationId,
      service_id: parsed.data.serviceId,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error) {
    if (isAppointmentOverlapError(error)) return { error: "appointmentOverlap" };
    return { error: "createFailed" };
  }

  await supabase
    .from("appointment_waitlist")
    .update({
      status: "booked",
      offered_appointment_id: appointment.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", waitlistId)
    .eq("clinic_id", profile.clinic_id);

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "waitlist.booked",
    payload: {
      waitlist_id: waitlistId,
      appointment_id: appointment.id,
      patient_id: parsed.data.patientId,
    },
  });

  revalidateCalendar(locale);
  return { message: "waitlistBooked" };
}
