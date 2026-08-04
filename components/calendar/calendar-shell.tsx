"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import type { DoctorOption } from "@/components/calendar/appointment-form";
import {
  DeferredAppointmentForm,
  DeferredWaitlistPanel,
  type CalendarFormOptions,
} from "@/components/calendar/calendar-form-options";
import { DayWeekGrid } from "@/components/calendar/day-week-grid";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WeekAgenda } from "@/components/calendar/week-agenda";
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
  CALENDAR_VIEW_STORAGE_KEY,
  CLINIC_TIMEZONE,
  daysInRange,
  formatDateKey,
  isCalendarView,
  parseAnchorDate,
  parseView,
  rangeForView,
  shiftAnchor,
  SLOT_MINUTES,
  titleForRange,
  type CalendarView,
} from "@/lib/calendar/time";
import { appointmentStatuses } from "@/lib/validations/appointment";
import { cn } from "@/lib/utils";

function useIsMobileCalendar() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

export function CalendarShell({
  initialView,
  hasViewQuery,
  initialDate,
  initialDoctorId,
  appointments,
  waitlist,
  doctors,
  formOptionsPromise,
  canWrite,
  canPickDoctor,
  canDrag,
  showWaitlist,
  canWriteWaitlist,
  canSendReminder,
  currentUserId,
}: {
  initialView: string;
  hasViewQuery: boolean;
  initialDate: string;
  initialDoctorId: string;
  appointments: CalendarAppointment[];
  waitlist: WaitlistRow[];
  doctors: DoctorOption[];
  formOptionsPromise: Promise<CalendarFormOptions>;
  canWrite: boolean;
  canPickDoctor: boolean;
  canDrag: boolean;
  showWaitlist: boolean;
  canWriteWaitlist: boolean;
  canSendReminder: boolean;
  currentUserId: string;
}) {
  const t = useTranslations("Calendar");
  const tw = useTranslations("Waitlist");
  const locale = useLocale();
  const router = useRouter();
  const view = parseView(initialView);
  const anchor = parseAnchorDate(initialDate || undefined);
  const isMobile = useIsMobileCalendar();
  const [doctorFilter, setDoctorFilter] = useState(initialDoctorId);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
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

  const waitingCount = waitlist.filter((r) => r.status === "waiting").length;

  const navigate = useCallback(
    (next: {
      view?: CalendarView;
      date?: Date;
      doctorId?: string;
    }) => {
      const nextView = next.view ?? view;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, nextView);
        } catch {
          // ignore quota / private mode
        }
      }
      const params = new URLSearchParams();
      params.set("view", nextView);
      params.set(
        "date",
        formatDateKey(next.date ?? anchor, CLINIC_TIMEZONE),
      );
      const doc = next.doctorId ?? doctorFilter;
      if (doc) params.set("doctorId", doc);
      router.push({
        pathname: "/calendar",
        query: Object.fromEntries(params.entries()),
      });
    },
    [anchor, doctorFilter, router, view],
  );

  // Restore last view when URL has no explicit ?view=
  useEffect(() => {
    if (hasViewQuery) return;
    try {
      const saved = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
      if (isCalendarView(saved) && saved !== view) {
        navigate({ view: saved });
      } else if (!saved) {
        window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
      }
    } catch {
      // ignore
    }
    // Intentionally once on mount for URL without view param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasViewQuery]);

  // Open waitlist sheet when cancel yields suggestions
  useEffect(() => {
    if (suggestions.length > 0) setWaitlistOpen(true);
  }, [suggestions]);

  const title = titleForRange(view, anchor, locale, CLINIC_TIMEZONE);
  const monthKey = formatDateKey(anchor, CLINIC_TIMEZONE);
  const useAgenda = view === "week" && isMobile;

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
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {showWaitlist ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="calendar-waitlist-open"
              onClick={() => setWaitlistOpen(true)}
            >
              {tw("title")}
              {waitingCount > 0 || suggestions.length > 0 ? (
                <span className="bg-primary text-primary-foreground ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-semibold">
                  {suggestions.length > 0 ? suggestions.length : waitingCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              data-testid="calendar-new-appointment"
              onClick={() => {
                const start = new Date();
                openCreate(start, addMinutes(start, SLOT_MINUTES));
              }}
            >
              {t("new")}
            </Button>
          ) : null}
        </div>
      </div>

      {flash ? (
        <p className="text-sm text-emerald-700" role="status">
          {t(`messages.${flash}` as "messages.appointmentCreated")}
        </p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent
          className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg"
          data-testid="calendar-appointment-panel"
        >
          {panel ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {panel.type === "create" ? t("newTitle") : t("editTitle")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <DeferredAppointmentForm
                  key={
                    panel.type === "create"
                      ? `create-${panel.startsAt}`
                      : panel.appointment.id
                  }
                  formOptionsPromise={formOptionsPromise}
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
                              setError(
                                t(
                                  `errors.${result.error}` as "errors.saveFailed",
                                ),
                              );
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
                                t(
                                  `errors.${result.error}` as "errors.saveFailed",
                                ),
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
                              setError(
                                t(
                                  `errors.${result.error}` as "errors.saveFailed",
                                ),
                              );
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
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {showWaitlist ? (
        <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
          <DialogContent
            className={cn(
              "fixed z-50 flex max-h-[min(90dvh,40rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
              // Mobile: bottom sheet
              "top-auto bottom-3 left-1/2 -translate-x-1/2 translate-y-0 rounded-2xl data-open:zoom-in-100 data-closed:zoom-out-100",
              // Desktop: right sheet
              "sm:top-3 sm:right-3 sm:bottom-3 sm:left-auto sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:translate-x-0 sm:rounded-2xl",
            )}
            data-testid="calendar-waitlist-sheet"
          >
            <DialogHeader className="border-b px-4 py-3 pr-12">
              <DialogTitle>{tw("title")}</DialogTitle>
              <DialogDescription>{tw("subtitle")}</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-4 py-4">
              <DeferredWaitlistPanel
                formOptionsPromise={formOptionsPromise}
                rows={waitlist}
                doctors={doctors}
                canWrite={canWriteWaitlist}
                suggestions={suggestions}
                onClearSuggestions={() => setSuggestions([])}
                defaultDoctorId={defaultDoctorId}
                hideHeader
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <div className="bg-background/95 sticky top-14 z-20 -mx-1 space-y-3 border-b px-1 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/80 md:top-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-base leading-snug font-semibold">{title}</p>
            <p className="text-muted-foreground hidden text-xs sm:block">
              {t("timezoneHint")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
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
              className="w-full sm:w-auto"
              onClick={() => navigate({ date: new Date() })}
            >
              {t("today")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() =>
                navigate({ date: shiftAnchor(view, anchor, 1) })
              }
            >
              {t("next")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div
            className="bg-muted/60 inline-grid grid-cols-3 gap-0.5 rounded-lg p-0.5 sm:inline-flex"
            role="group"
            aria-label={t("viewsLabel")}
          >
            {(["day", "week", "month"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={view === v ? "default" : "ghost"}
                className="w-full shadow-none sm:w-auto"
                onClick={() => navigate({ view: v })}
              >
                {t(`views.${v}`)}
              </Button>
            ))}
          </div>
          {canPickDoctor ? (
            <select
              className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto sm:min-w-[10rem]"
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
      </div>

      <div className="min-w-0">
        {view === "month" ? (
          <MonthGrid
            days={days}
            currentMonthKey={monthKey}
            appointments={filteredAppointments}
            onSelectDay={(day) => navigate({ view: "day", date: day })}
            onSelectAppointment={openEdit}
          />
        ) : useAgenda ? (
          <WeekAgenda
            days={days}
            appointments={filteredAppointments}
            canWrite={canWrite}
            onSelect={openEdit}
            onCreatedSlot={openCreate}
            onOpenDay={(day) => navigate({ view: "day", date: day })}
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
      </div>
    </div>
  );
}
