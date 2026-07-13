"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { rescheduleAppointmentAction } from "@/lib/appointments/actions";
import {
  CLINIC_TIMEZONE,
  DAY_END_HOUR,
  DAY_START_HOUR,
  durationMinutes,
  formatDateKey,
  minutesFromDayStart,
  SLOT_MINUTES,
  slotStartsForDay,
} from "@/lib/calendar/time";
import type { CalendarAppointment } from "@/components/calendar/types";

const PX_PER_MINUTE = 1.2;
const DAY_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PX_PER_MINUTE;

const STATUS_CLASS: Record<string, string> = {
  pending_confirmation: "bg-amber-100 text-amber-950 ring-amber-200",
  confirmed: "bg-sky-100 text-sky-950 ring-sky-200",
  completed: "bg-emerald-100 text-emerald-950 ring-emerald-200",
  cancelled: "bg-muted text-muted-foreground ring-border line-through",
  no_show: "bg-rose-100 text-rose-950 ring-rose-200",
};

export function DayWeekGrid({
  days,
  appointments,
  canDrag,
  onSelect,
  onCreatedSlot,
}: {
  days: Date[];
  appointments: CalendarAppointment[];
  canDrag: boolean;
  onSelect: (appointment: CalendarAppointment) => void;
  onCreatedSlot: (startsAt: Date, endsAt: Date) => void;
}) {
  const t = useTranslations("Calendar");
  const [pending, startTransition] = useTransition();

  function appointmentsForDay(day: Date) {
    const key = formatDateKey(day, CLINIC_TIMEZONE);
    return appointments.filter(
      (a) => formatDateKey(new Date(a.startsAt), CLINIC_TIMEZONE) === key,
    );
  }

  function onDropSlot(slotStart: Date, appointmentId: string) {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment || !canDrag) return;
    const duration = durationMinutes(appointment.startsAt, appointment.endsAt);
    const endsAt = addMinutes(slotStart, duration);
    startTransition(async () => {
      await rescheduleAppointmentAction(
        appointmentId,
        slotStart.toISOString(),
        endsAt.toISOString(),
      );
    });
  }

  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => DAY_START_HOUR + i,
  );

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px]"
        style={{
          gridTemplateColumns: `48px repeat(${days.length}, minmax(120px, 1fr))`,
        }}
      >
        <div />
        {days.map((day) => (
          <div
            key={formatDateKey(day, CLINIC_TIMEZONE)}
            className="border-b px-2 py-2 text-center text-sm font-medium"
          >
            {formatInTimeZone(day, CLINIC_TIMEZONE, "EEE d MMM")}
          </div>
        ))}

        <div className="relative" style={{ height: DAY_HEIGHT }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="text-muted-foreground absolute right-1 text-xs"
              style={{
                top: (hour - DAY_START_HOUR) * 60 * PX_PER_MINUTE - 6,
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayAppts = appointmentsForDay(day);
          const slots = slotStartsForDay(day, CLINIC_TIMEZONE);
          return (
            <div
              key={formatDateKey(day, CLINIC_TIMEZONE)}
              className="relative border-l"
              style={{ height: DAY_HEIGHT }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-border/60 absolute inset-x-0 border-t"
                  style={{
                    top: (hour - DAY_START_HOUR) * 60 * PX_PER_MINUTE,
                  }}
                />
              ))}

              {slots.map((slot) => (
                <button
                  key={slot.toISOString()}
                  type="button"
                  className="hover:bg-muted/40 absolute inset-x-0 z-0"
                  style={{
                    top: minutesFromDayStart(slot.toISOString()) * PX_PER_MINUTE,
                    height: SLOT_MINUTES * PX_PER_MINUTE,
                  }}
                  aria-label={t("newAt", {
                    time: formatInTimeZone(slot, CLINIC_TIMEZONE, "HH:mm"),
                  })}
                  disabled={pending}
                  onClick={() =>
                    onCreatedSlot(slot, addMinutes(slot, SLOT_MINUTES))
                  }
                  onDragOver={(e) => {
                    if (canDrag) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/appointment-id");
                    if (id) onDropSlot(slot, id);
                  }}
                />
              ))}

              {dayAppts.map((appt) => {
                const top =
                  minutesFromDayStart(appt.startsAt) * PX_PER_MINUTE;
                const height =
                  durationMinutes(appt.startsAt, appt.endsAt) * PX_PER_MINUTE;
                const cancelled =
                  appt.status === "cancelled" || appt.status === "no_show";
                return (
                  <button
                    key={appt.id}
                    type="button"
                    draggable={canDrag && !cancelled}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/appointment-id", appt.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(appt);
                    }}
                    className={cn(
                      "absolute inset-x-1 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs ring-1",
                      STATUS_CLASS[appt.status] ?? STATUS_CLASS.confirmed,
                      canDrag && !cancelled && "cursor-grab active:cursor-grabbing",
                    )}
                    style={{
                      top: Math.max(0, top),
                      height: Math.max(18, height),
                    }}
                  >
                    <div className="truncate font-medium">
                      {appt.patientName}
                    </div>
                    <div className="truncate opacity-80">
                      {formatInTimeZone(
                        new Date(appt.startsAt),
                        CLINIC_TIMEZONE,
                        "HH:mm",
                      )}
                      {appt.serviceName ? ` · ${appt.serviceName}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
