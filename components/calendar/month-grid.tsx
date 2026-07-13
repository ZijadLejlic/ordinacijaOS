"use client";

import { useTranslations } from "next-intl";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import {
  CLINIC_TIMEZONE,
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
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    formatInTimeZone(
      days[i] ?? days[0],
      CLINIC_TIMEZONE,
      "EEE",
    ),
  );

  // Prefer fixed Mon–Sun labels from first week of grid
  const labels = days.slice(0, 7).map((d) =>
    formatInTimeZone(d, CLINIC_TIMEZONE, "EEE"),
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
        {(labels.length === 7 ? labels : weekdays).map((label) => (
          <div key={label} className="text-muted-foreground py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = formatDateKey(day, CLINIC_TIMEZONE);
          const inMonth = key.startsWith(currentMonthKey.slice(0, 7));
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
                "border-border min-h-24 rounded-lg border p-1.5 text-left align-top",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
              )}
            >
              <div className="mb-1 text-xs font-medium">
                {formatInTimeZone(day, CLINIC_TIMEZONE, "d")}
              </div>
              <ul className="space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <span
                      role="button"
                      tabIndex={0}
                      className="bg-sky-100 text-sky-950 block truncate rounded px-1 text-[10px]"
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
                      {formatInTimeZone(
                        new Date(a.startsAt),
                        CLINIC_TIMEZONE,
                        "HH:mm",
                      )}{" "}
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
