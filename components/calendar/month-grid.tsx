"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { appointmentStatusClass } from "@/components/calendar/status-styles";
import {
  CLINIC_TIMEZONE,
  formatClinicDate,
  formatDateKey,
} from "@/lib/calendar/time";
import type { CalendarAppointment } from "@/components/calendar/types";

export function MonthGrid({
  days,
  currentMonthKey,
  appointments,
  onSelectDay,
  onSelectAppointment,
}: {
  days: Date[];
  currentMonthKey: string;
  appointments: CalendarAppointment[];
  onSelectDay: (day: Date) => void;
  onSelectAppointment: (appointment: CalendarAppointment) => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    formatClinicDate(days[i] ?? days[0]!, "EEE", locale),
  );
  const todayKey = formatDateKey(new Date(), CLINIC_TIMEZONE);

  // Prefer fixed Mon–Sun labels from first week of grid
  const labels = days.slice(0, 7).map((d) =>
    formatClinicDate(d, "EEE", locale),
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium sm:gap-1 sm:text-xs">
        {(labels.length === 7 ? labels : weekdays).map((label) => (
          <div key={label} className="text-muted-foreground truncate py-1">
            <span className="sm:hidden">{label.slice(0, 1)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((day) => {
          const key = formatDateKey(day, CLINIC_TIMEZONE);
          const inMonth = key.startsWith(currentMonthKey.slice(0, 7));
          const isToday = key === todayKey;
          const dayAppts = appointments.filter(
            (a) =>
              formatDateKey(new Date(a.startsAt), CLINIC_TIMEZONE) === key,
          );
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "border-border min-h-14 rounded-md border p-1 text-left align-top sm:min-h-24 sm:rounded-lg sm:p-1.5",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                isToday && "border-primary/40 bg-primary/[0.04]",
              )}
            >
              <div className="flex items-center justify-between gap-0.5 text-xs font-medium">
                <span
                  className={cn(
                    isToday &&
                      "bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[11px]",
                  )}
                >
                  {formatClinicDate(day, "d", locale)}
                </span>
                {dayAppts.length > 0 ? (
                  <span className="bg-sky-50 text-sky-950 ring-sky-100 inline-flex min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold ring-1 sm:hidden">
                    {dayAppts.length}
                  </span>
                ) : null}
              </div>
              <ul className="mt-1 hidden space-y-0.5 sm:block">
                {dayAppts.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <span
                      role="button"
                      tabIndex={0}
                      className={appointmentStatusClass(
                        a.status,
                        "block truncate rounded-md px-1 py-0.5 text-[10px]",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAppointment(a);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          onSelectAppointment(a);
                        }
                      }}
                    >
                      {formatClinicDate(a.startsAt, "HH:mm", locale)}{" "}
                      {a.patientName}
                    </span>
                  </li>
                ))}
                {dayAppts.length > 3 ? (
                  <li className="text-muted-foreground text-[10px]">
                    {t("moreCount", { count: dayAppts.length - 3 })}
                  </li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
