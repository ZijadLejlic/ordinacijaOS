"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { AppointmentForm } from "@/components/calendar/appointment-form";
import type {
  DoctorOption,
  LocationOption,
  PatientOption,
  ServiceOption,
} from "@/components/calendar/appointment-form";
import { DayWeekGrid } from "@/components/calendar/day-week-grid";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WaitlistPanel } from "@/components/calendar/waitlist-panel";
import type {
  CalendarAppointment,
  WaitlistRow,
} from "@/components/calendar/types";
import {
  cancelAppointmentAction,
  updateAppointmentStatusAction,
  type WaitlistSuggestion,
} from "@/lib/appointments/actions";
import { sendAppointmentReminderAction } from "@/lib/email/actions";
import {
  CLINIC_TIMEZONE,
  daysInRange,
  formatDateKey,
  parseAnchorDate,
  parseView,
  rangeForView,
  shiftAnchor,
  SLOT_MINUTES,
  titleForRange,
  type CalendarView,
} from "@/lib/calendar/time";
import { appointmentStatuses } from "@/lib/validations/appointment";

export function CalendarShell({
  initialView,
  initialDate,
  initialDoctorId,
  appointments,
  waitlist,
  doctors,
  patients,
  services,
  locations,
  canWrite,
  canPickDoctor,
  canDrag,
  showWaitlist,
  canWriteWaitlist,
  canSendReminder,
  currentUserId,
}: {
  initialView: string;
  initialDate: string;
  initialDoctorId: string;
  appointments: CalendarAppointment[];
  waitlist: WaitlistRow[];
  doctors: DoctorOption[];
  patients: PatientOption[];
  services: ServiceOption[];
  locations: LocationOption[];
  canWrite: boolean;
  canPickDoctor: boolean;
  canDrag: boolean;
  showWaitlist: boolean;
  canWriteWaitlist: boolean;
  canSendReminder: boolean;
  currentUserId: string;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const router = useRouter();
  const view = parseView(initialView);
  const anchor = parseAnchorDate(initialDate || undefined);
  const [doctorFilter, setDoctorFilter] = useState(initialDoctorId);
  const [panel, setPanel] = useState<
    | { type: "create"; startsAt: string; endsAt: string }
    | { type: "edit"; appointment: CalendarAppointment }
    | null
  >(null);
  const [suggestions, setSuggestions] = useState<WaitlistSuggestion[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { rangeStart, rangeEnd } = rangeForView(view, anchor, CLINIC_TIMEZONE);
  const days = daysInRange(rangeStart, rangeEnd);

  const filteredAppointments = useMemo(() => {
    if (!doctorFilter) return appointments;
    return appointments.filter((a) => a.doctorId === doctorFilter);
  }, [appointments, doctorFilter]);

  const defaultDoctorId = canPickDoctor
    ? doctorFilter || doctors[0]?.id || ""
    : currentUserId;

  const navigate = useCallback(
    (next: {
      view?: CalendarView;
      date?: Date;
      doctorId?: string;
    }) => {
      const params = new URLSearchParams();
      params.set("view", next.view ?? view);
      params.set(
        "date",
        formatDateKey(next.date ?? anchor, CLINIC_TIMEZONE),
      );
      const doc = next.doctorId ?? doctorFilter;
      if (doc) params.set("doctorId", doc);
      router.push(`/calendar?${params.toString()}`);
    },
    [anchor, doctorFilter, router, view],
  );

  const title = titleForRange(view, anchor, locale, CLINIC_TIMEZONE);
  const monthKey = formatDateKey(anchor, CLINIC_TIMEZONE);

  function openCreate(startsAt: Date, endsAt: Date) {
    if (!canWrite) return;
    setPanel({
      type: "create",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    setError(null);
  }

  function openEdit(appointment: CalendarAppointment) {
    setPanel({ type: "edit", appointment });
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            onClick={() => {
              const start = new Date();
              openCreate(start, addMinutes(start, SLOT_MINUTES));
            }}
          >
            {t("new")}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{t("timezoneHint")}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate({ date: shiftAnchor(view, anchor, -1) })
                }
              >
                {t("prev")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate({ date: new Date() })}
              >
                {t("today")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate({ date: shiftAnchor(view, anchor, 1) })
                }
              >
                {t("next")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={view === v ? "default" : "outline"}
                onClick={() => navigate({ view: v })}
              >
                {t(`views.${v}`)}
              </Button>
            ))}
            {canPickDoctor ? (
              <select
                className="border-input bg-background h-7 rounded-lg border px-2 text-sm"
                value={doctorFilter}
                onChange={(e) => {
                  setDoctorFilter(e.target.value);
                  navigate({ doctorId: e.target.value });
                }}
              >
                <option value="">{t("allDoctors")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {flash ? (
            <p className="text-sm text-emerald-700" role="status">
              {t(`messages.${flash}` as "messages.appointmentCreated")}
            </p>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}

          {view === "month" ? (
            <MonthGrid
              days={days}
              currentMonthKey={monthKey}
              appointments={filteredAppointments}
              onSelectDay={(day) => navigate({ view: "day", date: day })}
              onSelectAppointment={openEdit}
            />
          ) : (
            <DayWeekGrid
              days={days}
              appointments={filteredAppointments}
              canDrag={canDrag && canWrite}
              onSelect={openEdit}
              onCreatedSlot={openCreate}
            />
          )}
        </CardContent>
      </Card>

      {panel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {panel.type === "create" ? t("newTitle") : t("editTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AppointmentForm
              mode={panel.type === "create" ? "create" : "edit"}
              initial={
                panel.type === "create"
                  ? {
                      doctorId: defaultDoctorId,
                      patientId: "",
                      locationId: null,
                      serviceId: null,
                      startsAt: panel.startsAt,
                      endsAt: panel.endsAt,
                      status: "confirmed",
                      notes: null,
                    }
                  : {
                      id: panel.appointment.id,
                      doctorId: panel.appointment.doctorId,
                      patientId: panel.appointment.patientId,
                      locationId: panel.appointment.locationId,
                      serviceId: panel.appointment.serviceId,
                      startsAt: panel.appointment.startsAt,
                      endsAt: panel.appointment.endsAt,
                      status: panel.appointment.status,
                      notes: panel.appointment.notes,
                    }
              }
              doctors={doctors}
              patients={patients}
              services={services}
              locations={locations}
              canPickDoctor={canPickDoctor}
              onClose={() => setPanel(null)}
              onSuccess={(message) => {
                setFlash(message ?? null);
                setPanel(null);
              }}
            />
            {panel.type === "edit" && (canWrite || canSendReminder) ? (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {canWrite ? (
                  <select
                    className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                    defaultValue={panel.appointment.status}
                    disabled={pending}
                    onChange={(e) => {
                      const status = e.target.value;
                      startTransition(async () => {
                        const result = await updateAppointmentStatusAction(
                          panel.appointment.id,
                          status,
                        );
                        if (result?.error) {
                          setError(t(`errors.${result.error}` as "errors.saveFailed"));
                          return;
                        }
                        if (result?.waitlistSuggestions?.length) {
                          setSuggestions(result.waitlistSuggestions);
                        }
                        setFlash(result?.message ?? "appointmentUpdated");
                        setPanel(null);
                      });
                    }}
                  >
                    {appointmentStatuses.map((s) => (
                      <option key={s} value={s}>
                        {t(`statuses.${s}`)}
                      </option>
                    ))}
                  </select>
                ) : null}
                {canSendReminder &&
                panel.appointment.status !== "cancelled" &&
                panel.appointment.status !== "no_show" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await sendAppointmentReminderAction(
                          panel.appointment.id,
                          locale,
                        );
                        if (result?.error) {
                          setError(
                            t(`errors.${result.error}` as "errors.saveFailed"),
                          );
                          return;
                        }
                        setFlash("reminderSent");
                      });
                    }}
                  >
                    {t("sendReminder")}
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await cancelAppointmentAction(
                          panel.appointment.id,
                        );
                        if (result?.error) {
                          setError(t(`errors.${result.error}` as "errors.saveFailed"));
                          return;
                        }
                        if (result?.waitlistSuggestions?.length) {
                          setSuggestions(result.waitlistSuggestions);
                        }
                        setFlash("appointmentCancelled");
                        setPanel(null);
                      });
                    }}
                  >
                    {t("cancelAppointment")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showWaitlist ? (
        <Card>
          <CardContent className="pt-6">
            <WaitlistPanel
              rows={waitlist}
              doctors={doctors}
              patients={patients}
              services={services}
              locations={locations}
              canWrite={canWriteWaitlist}
              suggestions={suggestions}
              onClearSuggestions={() => setSuggestions([])}
              defaultDoctorId={defaultDoctorId}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
