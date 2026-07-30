import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import {
  canAccessCalendar,
  canAccessWaitlist,
  canManageAllDoctors,
  canWriteCalendar,
  canWriteWaitlist,
} from "@/lib/calendar/rbac";
import { canSendEmailReminders } from "@/lib/email/rbac";
import {
  CLINIC_TIMEZONE,
  formatDateKey,
  parseAnchorDate,
  parseView,
  rangeForView,
} from "@/lib/calendar/time";
import { getClinicEntitlements } from "@/lib/entitlements";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    view?: string;
    date?: string;
    doctorId?: string;
  }>;
};

export default async function CalendarPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { view: viewParam, date: dateParam, doctorId: doctorParam } =
    await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Calendar");
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id, is_active")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.is_active || !canAccessCalendar(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const clinicProfile = profile!;

  // Shares request cache with dashboard layout (one entitlements load).
  const entitlements = await getClinicEntitlements(
    supabase,
    clinicProfile.clinic_id,
  );
  if (!entitlements.features.calendar_basic.enabled) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("errors.featureDisabled")}
        </p>
      </main>
    );
  }

  const view = parseView(viewParam);
  const anchor = parseAnchorDate(dateParam);
  const { rangeStart, rangeEnd } = rangeForView(view, anchor, CLINIC_TIMEZONE);
  const canPickDoctor = canManageAllDoctors(clinicProfile.role);
  const doctorFilter =
    canPickDoctor && doctorParam ? doctorParam : !canPickDoctor ? clinicProfile.id : "";

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_id, location_id, service_id, starts_at, ends_at, status, notes, patients(first_name, last_name), services(name)",
    )
    .eq("clinic_id", clinicProfile.clinic_id)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (doctorFilter) {
    appointmentsQuery = appointmentsQuery.eq("doctor_id", doctorFilter);
  }

  const showWaitlistUi =
    canAccessWaitlist(clinicProfile.role) &&
    entitlements.features.waitlist_auto.enabled;

  const canDrag = entitlements.features.calendar_advanced.enabled;

  const canSendReminder =
    canSendEmailReminders(clinicProfile.role) &&
    entitlements.features.email_reminders.enabled;

  const [
    { data: appointments },
    { data: doctors },
    { data: patients },
    { data: services },
    { data: locations },
    waitlistResult,
  ] = await Promise.all([
    appointmentsQuery,
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicProfile.clinic_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("patients")
      .select("id, first_name, last_name, is_active")
      .eq("clinic_id", clinicProfile.clinic_id)
      .order("last_name", { ascending: true })
      .limit(500),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("clinic_id", clinicProfile.clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("clinic_locations")
      .select("id, name")
      .eq("clinic_id", clinicProfile.clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    showWaitlistUi
      ? supabase
          .from("appointment_waitlist")
          .select(
            "id, patient_id, doctor_id, service_id, location_id, preferred_from, preferred_to, notes, status, created_at, patients(first_name, last_name)",
          )
          .eq("clinic_id", clinicProfile.clinic_id)
          .eq("status", "waiting")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);

  const doctorNameById = new Map(
    (doctors ?? []).map((d) => [d.id, d.full_name]),
  );

  const mappedAppointments = (appointments ?? []).map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    const service = Array.isArray(row.services) ? row.services[0] : row.services;
    return {
      id: row.id,
      doctorId: row.doctor_id,
      doctorName: doctorNameById.get(row.doctor_id) ?? "",
      patientId: row.patient_id,
      patientName: [patient?.first_name, patient?.last_name]
        .filter(Boolean)
        .join(" "),
      locationId: row.location_id,
      serviceId: row.service_id,
      serviceName: service?.name ?? null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      notes: row.notes,
    };
  });

  const mappedWaitlist = (waitlistResult.data ?? []).map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: [patient?.first_name, patient?.last_name]
        .filter(Boolean)
        .join(" "),
      doctorId: row.doctor_id,
      serviceId: row.service_id,
      locationId: row.location_id,
      preferredFrom: row.preferred_from,
      preferredTo: row.preferred_to,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:py-10">
      <CalendarShell
        initialView={view}
        initialDate={formatDateKey(anchor, CLINIC_TIMEZONE)}
        initialDoctorId={doctorFilter}
        appointments={mappedAppointments}
        waitlist={mappedWaitlist}
        doctors={(doctors ?? []).map((d) => ({
          id: d.id,
          fullName: d.full_name,
        }))}
        patients={(patients ?? []).map((p) => ({
          id: p.id,
          fullName: `${p.first_name} ${p.last_name}`.trim(),
          isActive: p.is_active,
        }))}
        services={(services ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.duration_minutes,
        }))}
        locations={(locations ?? []).map((l) => ({
          id: l.id,
          name: l.name,
        }))}
        canWrite={canWriteCalendar(clinicProfile.role)}
        canPickDoctor={canPickDoctor}
        canDrag={canDrag}
        showWaitlist={showWaitlistUi}
        canWriteWaitlist={canWriteWaitlist(clinicProfile.role)}
        canSendReminder={canSendReminder}
        currentUserId={clinicProfile.id}
      />
    </main>
  );
}
