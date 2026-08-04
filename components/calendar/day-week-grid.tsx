"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { appointmentStatusClass } from "@/components/calendar/status-styles";
import { rescheduleAppointmentAction } from "@/lib/appointments/actions";
import {
  CLINIC_TIMEZONE,
  DAY_END_HOUR,
  DAY_START_HOUR,
  durationMinutes,
  formatClinicDate,
  formatDateKey,
  minutesFromDayStart,
  SLOT_MINUTES,
  slotStartsForDay,
} from "@/lib/calendar/time";
import type { CalendarAppointment } from "@/components/calendar/types";

const PX_PER_MINUTE_DESKTOP = 1.2;
const PX_PER_MINUTE_MOBILE = 0.72;

function useCompactCalendarScale() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return compact;
}

function useNowMinutes() {
  const [mins, setMins] = useState(() =>
    minutesFromDayStart(new Date().toISOString()),
  );
  useEffect(() => {
    const tick = () => setMins(minutesFromDayStart(new Date().toISOString()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return mins;
}

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
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const compact = useCompactCalendarScale();
  const pxPerMinute = compact ? PX_PER_MINUTE_MOBILE : PX_PER_MINUTE_DESKTOP;
  const dayHeight = (DAY_END_HOUR - DAY_START_HOUR) * 60 * pxPerMinute;
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayKey = formatDateKey(new Date(), CLINIC_TIMEZONE);
  const nowMinutes = useNowMinutes();
  const showNowLine =
    nowMinutes >= 0 && nowMinutes <= (DAY_END_HOUR - DAY_START_HOUR) * 60;

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

  const isSingleDay = days.length === 1;
  const minColPx = isSingleDay ? 0 : 112;
  const gridMinWidth = isSingleDay ? undefined : 48 + days.length * minColPx;

  useEffect(() => {
    if (!scrollRef.current) return;
    if (!compact && !isSingleDay) return;
    const mins = minutesFromDayStart(new Date().toISOString());
    scrollRef.current.scrollTop = Math.max(0, mins * pxPerMinute - 72);
  }, [compact, isSingleDay, pxPerMinute, days]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "overflow-x-auto",
        compact &&
          "max-h-[min(62dvh,28rem)] overflow-y-auto overscroll-contain rounded-xl border",
        !compact && "rounded-xl border",
        !isSingleDay && !compact && "-mx-1 px-1",
      )}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: isSingleDay
            ? "40px minmax(0, 1fr)"
            : `48px repeat(${days.length}, minmax(${minColPx}px, 1fr))`,
          minWidth: gridMinWidth,
        }}
      >
        <div className="bg-background sticky top-0 z-[1] border-b" />
        {days.map((day) => {
          const key = formatDateKey(day, CLINIC_TIMEZONE);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={cn(
                "bg-background sticky top-0 z-[1] border-b px-2 py-2 text-center text-sm font-medium",
                isToday && "text-primary",
              )}
            >
              <span className="block">
                {formatClinicDate(
                  day,
                  compact ? "EEE d.M." : "EEE d MMM",
                  locale,
                )}
              </span>
              {isToday ? (
                <span className="text-primary/80 text-[10px] font-semibold tracking-wide uppercase">
                  {t("todayBadge")}
                </span>
              ) : null}
            </div>
          );
        })}

        <div className="relative" style={{ height: dayHeight }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="text-muted-foreground absolute right-1 text-xs tabular-nums"
              style={{
                top: (hour - DAY_START_HOUR) * 60 * pxPerMinute - 6,
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const key = formatDateKey(day, CLINIC_TIMEZONE);
          const isToday = key === todayKey;
          const dayAppts = appointmentsForDay(day);
          const slots = slotStartsForDay(day, CLINIC_TIMEZONE);
          return (
            <div
              key={key}
              className={cn(
                "relative border-l",
                isToday && "bg-primary/[0.035]",
              )}
              style={{ height: dayHeight }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-border/50 absolute inset-x-0 border-t"
                  style={{
                    top: (hour - DAY_START_HOUR) * 60 * pxPerMinute,
                  }}
                />
              ))}

              {slots.map((slot) => (
                <button
                  key={slot.toISOString()}
                  type="button"
                  className="hover:bg-muted/40 absolute inset-x-0 z-0"
                  style={{
                    top: minutesFromDayStart(slot.toISOString()) * pxPerMinute,
                    height: SLOT_MINUTES * pxPerMinute,
                  }}
                  aria-label={t("newAt", {
                    time: formatClinicDate(slot, "HH:mm", locale),
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

              {isToday && showNowLine ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: nowMinutes * pxPerMinute }}
                  aria-hidden
                >
                  <span className="bg-primary size-2 shrink-0 rounded-full" />
                  <span className="bg-primary h-px w-full" />
                </div>
              ) : null}

              {dayAppts.map((appt) => {
                const top = minutesFromDayStart(appt.startsAt) * pxPerMinute;
                const height =
                  durationMinutes(appt.startsAt, appt.endsAt) * pxPerMinute;
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
                      "absolute inset-x-1 z-10 overflow-hidden rounded-lg px-1.5 py-1 text-left text-xs shadow-none transition-[box-shadow,transform] hover:z-30 hover:shadow-sm",
                      appointmentStatusClass(appt.status),
                      canDrag &&
                        !cancelled &&
                        "cursor-grab active:cursor-grabbing",
                    )}
                    style={{
                      top: Math.max(0, top),
                      height: Math.max(compact ? 22 : 18, height),
                    }}
                  >
                    <div className="truncate font-semibold">
                      {appt.patientName}
                    </div>
                    <div className="truncate opacity-75">
                      {formatClinicDate(appt.startsAt, "HH:mm", locale)}
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
