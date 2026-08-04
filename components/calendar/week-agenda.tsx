"use client";

import { useLocale, useTranslations } from "next-intl";
import { addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { appointmentStatusClass } from "@/components/calendar/status-styles";
import type { CalendarAppointment } from "@/components/calendar/types";
import {
  CLINIC_TIMEZONE,
  formatClinicDate,
  formatDateKey,
  localInputToIso,
  SLOT_MINUTES,
} from "@/lib/calendar/time";

function clinicLocalDate(ymd: string, hour: number, minute: number): Date {
  return new Date(
    localInputToIso(
      `${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    ),
  );
}

export function WeekAgenda({
  days,
  appointments,
  canWrite,
  onSelect,
  onCreatedSlot,
  onOpenDay,
}: {
  days: Date[];
  appointments: CalendarAppointment[];
  canWrite: boolean;
  onSelect: (appointment: CalendarAppointment) => void;
  onCreatedSlot: (startsAt: Date, endsAt: Date) => void;
  onOpenDay: (day: Date) => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const todayKey = formatDateKey(new Date(), CLINIC_TIMEZONE);

  return (
    <div className="space-y-3" data-testid="calendar-week-agenda">
      {days.map((day) => {
        const key = formatDateKey(day, CLINIC_TIMEZONE);
        const isToday = key === todayKey;
        const dayAppts = appointments
          .filter(
            (a) =>
              formatDateKey(new Date(a.startsAt), CLINIC_TIMEZONE) === key,
          )
          .sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          );

        return (
          <section
            key={key}
            className={cn(
              "overflow-hidden rounded-xl border",
              isToday && "border-primary/30 bg-primary/[0.03]",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => onOpenDay(day)}
              >
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isToday && "text-primary",
                  )}
                >
                  {formatClinicDate(day, "EEEE", locale)}
                  {isToday ? (
                    <span className="text-muted-foreground ml-1.5 text-xs font-medium">
                      {t("todayBadge")}
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatClinicDate(day, "d MMMM yyyy", locale)}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {canWrite ? (
                  <button
                    type="button"
                    className="text-primary text-xs font-medium underline-offset-2 hover:underline"
                    onClick={() => {
                      const startsAt = clinicLocalDate(key, 9, 0);
                      onCreatedSlot(
                        startsAt,
                        addMinutes(startsAt, SLOT_MINUTES),
                      );
                    }}
                  >
                    {t("agendaAdd")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-muted-foreground text-xs font-medium underline-offset-2 hover:underline"
                  onClick={() => onOpenDay(day)}
                >
                  {t("agendaDayGrid")}
                </button>
              </div>
            </div>

            {dayAppts.length === 0 ? (
              <p className="text-muted-foreground px-3 py-3 text-sm">
                {t("agendaEmpty")}
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {dayAppts.map((appt) => (
                  <li key={appt.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                        appointmentStatusClass(
                          appt.status,
                          "rounded-none border-l-[3px] ring-0",
                        ),
                      )}
                      onClick={() => onSelect(appt)}
                    >
                      <span className="text-muted-foreground w-12 shrink-0 font-mono text-xs tabular-nums">
                        {formatClinicDate(appt.startsAt, "HH:mm", locale)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {appt.patientName}
                        </span>
                        {appt.serviceName ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {appt.serviceName}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
