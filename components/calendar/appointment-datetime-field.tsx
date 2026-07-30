"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { bs, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_MINUTES,
} from "@/lib/calendar/time";

type Props = {
  id: string;
  label: string;
  value: string; // yyyy-MM-dd'T'HH:mm
  onChange: (next: string) => void;
};

function parseLocalParts(value: string): { date: Date; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) {
    const now = new Date();
    return { date: now, time: format(now, "HH:mm") };
  }
  return {
    date: parse(match[1]!, "yyyy-MM-dd", new Date()),
    time: match[2]!,
  };
}

function composeLocal(date: Date, time: string): string {
  return `${format(date, "yyyy-MM-dd")}T${time}`;
}

function buildTimeSlots(currentTime: string): string[] {
  const slots: string[] = [];
  for (
    let minutes = DAY_START_HOUR * 60;
    minutes < DAY_END_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  }
  if (currentTime && !slots.includes(currentTime)) {
    slots.push(currentTime);
    slots.sort();
  }
  return slots;
}

export function AppointmentDateTimeField({
  id,
  label,
  value,
  onChange,
}: Props) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const dfLocale = locale === "en" ? enUS : bs;
  const [open, setOpen] = useState(false);
  const { date, time } = parseLocalParts(value);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(date));

  const timeSlots = useMemo(() => buildTimeSlots(time), [time]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const weekdays = useMemo(() => {
    const start = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(start, i), "EEEEEE", { locale: dfLocale }),
    );
  }, [dfLocale]);

  const summaryDate = format(date, "d. MMM yyyy.", { locale: dfLocale });

  function selectDate(next: Date) {
    onChange(composeLocal(next, time));
    setMonthCursor(startOfMonth(next));
  }

  function selectTime(nextTime: string) {
    onChange(composeLocal(date, nextTime));
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className={cn(
          "border-input bg-background hover:bg-muted/40 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
          "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
          open && "border-ring bg-muted/30 ring-ring/30 ring-3",
        )}
        onClick={() => {
          setOpen((v) => {
            if (!v) setMonthCursor(startOfMonth(date));
            return !v;
          });
        }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide uppercase">
            <CalendarDays className="size-3.5" aria-hidden />
            {t("pickDate")}
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            {summaryDate}
          </span>
        </span>
        <span className="bg-primary/10 text-primary flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums">
          <Clock className="size-3.5" aria-hidden />
          {time}
        </span>
      </button>

      {open ? (
        <div
          id={`${id}-panel`}
          className="border-border bg-card mt-2 overflow-hidden rounded-xl border shadow-sm"
        >
          <div className="grid gap-0 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3 p-3 sm:border-r sm:border-border">
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("prev")}
                  data-testid={`${id}-prev-month`}
                  onClick={() => setMonthCursor((m) => addMonths(m, -1))}
                >
                  <ChevronLeft />
                </Button>
                <p
                  className="text-sm font-semibold capitalize"
                  data-testid={`${id}-month`}
                  data-month={format(monthCursor, "yyyy-MM")}
                >
                  {format(monthCursor, "LLLL yyyy", { locale: dfLocale })}
                </p>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("next")}
                  data-testid={`${id}-next-month`}
                  onClick={() => setMonthCursor((m) => addMonths(m, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weekdays.map((d, i) => (
                  <div
                    key={`${d}-${i}`}
                    className="text-muted-foreground py-1 text-center text-[0.65rem] font-medium uppercase"
                  >
                    {d}
                  </div>
                ))}
                {days.map((day) => {
                  const selected = isSameDay(day, date);
                  const inMonth = isSameMonth(day, monthCursor);
                  const today = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      data-testid={`${id}-day`}
                      data-date={format(day, "yyyy-MM-dd")}
                      onClick={() => selectDate(day)}
                      className={cn(
                        "aspect-square rounded-lg text-sm tabular-nums transition-colors",
                        !inMonth && "text-muted-foreground/40",
                        inMonth && "text-foreground hover:bg-muted",
                        today && !selected && "ring-border font-medium ring-1",
                        selected &&
                          "bg-primary text-primary-foreground hover:bg-primary shadow-sm",
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const todayDate = new Date();
                  selectDate(todayDate);
                  setMonthCursor(startOfMonth(todayDate));
                }}
              >
                {t("today")}
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border p-3 sm:border-t-0">
              <p className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide uppercase">
                <Clock className="size-3.5" aria-hidden />
                {t("pickTime")}
              </p>
              <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5 sm:max-h-64">
                {timeSlots.map((slot) => {
                  const selected = slot === time;
                  return (
                    <button
                      key={slot}
                      type="button"
                      data-testid={`${id}-time`}
                      data-time={slot}
                      onClick={() => selectTime(slot)}
                      className={cn(
                        "rounded-lg border px-1.5 py-2 text-sm font-medium tabular-nums transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-transparent bg-muted/60 hover:bg-muted",
                      )}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-muted/40 flex items-center justify-end border-t border-border px-3 py-2">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {t("dateTimeDone")}
            </Button>
          </div>
        </div>
      ) : null}
    </Field>
  );
}
