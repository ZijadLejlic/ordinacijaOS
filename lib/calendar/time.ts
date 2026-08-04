import {
  addDays,
  addMinutes,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { bs, enUS, type Locale } from "date-fns/locale";
import * as dateFnsTz from "date-fns-tz";

const { formatInTimeZone, fromZonedTime, toZonedTime } = dateFnsTz;

export const CLINIC_TIMEZONE = "Europe/Sarajevo";

export function dateFnsLocale(locale: string): Locale {
  return locale === "en" ? enUS : bs;
}

function asDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === "number") return new Date(date);
  return parseISO(date);
}

/** Clinic-timezone date label in the active UI locale (BS default, EN). */
export function formatClinicDate(
  date: Date | string | number,
  pattern: string,
  locale: string,
  timeZone = CLINIC_TIMEZONE,
): string {
  return formatInTimeZone(asDate(date), timeZone, pattern, {
    locale: dateFnsLocale(locale),
  });
}

export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 20;
export const SLOT_MINUTES = 30;

export type CalendarView = "day" | "week" | "month";

export function isCalendarView(raw: string | null | undefined): raw is CalendarView {
  return raw === "week" || raw === "month" || raw === "day";
}

export function parseView(raw: string | undefined): CalendarView {
  if (isCalendarView(raw)) return raw;
  return "week";
}

export const CALENDAR_VIEW_STORAGE_KEY = "dentord:calendar:view";

export function parseAnchorDate(
  raw: string | undefined,
  timeZone = CLINIC_TIMEZONE,
): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return fromZonedTime(`${raw}T12:00:00`, timeZone);
  }
  return new Date();
}

export function formatDateKey(date: Date, timeZone = CLINIC_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export function formatDateTimeLocal(
  iso: string,
  timeZone = CLINIC_TIMEZONE,
): string {
  return formatInTimeZone(parseISO(iso), timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function formatTimeLabel(
  iso: string,
  timeZone = CLINIC_TIMEZONE,
): string {
  return formatInTimeZone(parseISO(iso), timeZone, "HH:mm");
}

export function localInputToIso(
  localValue: string,
  timeZone = CLINIC_TIMEZONE,
): string {
  return fromZonedTime(localValue, timeZone).toISOString();
}

function zonedYmd(date: Date, timeZone: string): string {
  return format(toZonedTime(date, timeZone), "yyyy-MM-dd");
}

function startOfZonedDay(ymd: string, timeZone: string): Date {
  return fromZonedTime(`${ymd}T00:00:00`, timeZone);
}

export function rangeForView(
  view: CalendarView,
  anchor: Date,
  timeZone = CLINIC_TIMEZONE,
): { rangeStart: Date; rangeEnd: Date } {
  const zoned = toZonedTime(anchor, timeZone);

  if (view === "day") {
    const ymd = format(zoned, "yyyy-MM-dd");
    const rangeStart = startOfZonedDay(ymd, timeZone);
    return { rangeStart, rangeEnd: addDays(rangeStart, 1) };
  }

  if (view === "week") {
    const weekStart = startOfWeek(zoned, { weekStartsOn: 1 });
    const ymd = format(weekStart, "yyyy-MM-dd");
    const rangeStart = startOfZonedDay(ymd, timeZone);
    return { rangeStart, rangeEnd: addDays(rangeStart, 7) };
  }

  const monthStart = startOfMonth(zoned);
  const monthEnd = endOfMonth(zoned);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const startYmd = format(gridStart, "yyyy-MM-dd");
  const endYmd = format(gridEnd, "yyyy-MM-dd");
  const rangeStart = startOfZonedDay(startYmd, timeZone);
  const rangeEnd = addDays(startOfZonedDay(endYmd, timeZone), 1);
  return { rangeStart, rangeEnd };
}

/** One Date per clinic-local calendar day in [rangeStart, rangeEnd). */
export function daysInRange(
  rangeStart: Date,
  rangeEnd: Date,
  timeZone = CLINIC_TIMEZONE,
): Date[] {
  const days: Date[] = [];
  let cursor = startOfZonedDay(zonedYmd(rangeStart, timeZone), timeZone);
  while (cursor < rangeEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function slotStartsForDay(
  day: Date,
  timeZone = CLINIC_TIMEZONE,
): Date[] {
  const key = formatDateKey(day, timeZone);
  const slots: Date[] = [];
  for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      slots.push(
        fromZonedTime(
          `${key}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
          timeZone,
        ),
      );
    }
  }
  return slots;
}

export function minutesFromDayStart(
  iso: string,
  timeZone = CLINIC_TIMEZONE,
): number {
  const hh = Number(formatInTimeZone(parseISO(iso), timeZone, "H"));
  const mm = Number(formatInTimeZone(parseISO(iso), timeZone, "m"));
  return hh * 60 + mm - DAY_START_HOUR * 60;
}

export function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(
    SLOT_MINUTES,
    Math.round(
      (parseISO(endsAt).getTime() - parseISO(startsAt).getTime()) / 60000,
    ),
  );
}

export function shiftAnchor(
  view: CalendarView,
  anchor: Date,
  direction: -1 | 1,
  timeZone = CLINIC_TIMEZONE,
): Date {
  const zoned = toZonedTime(anchor, timeZone);
  if (view === "day") {
    const next = addDays(zoned, direction);
    return fromZonedTime(`${format(next, "yyyy-MM-dd")}T12:00:00`, timeZone);
  }
  if (view === "week") {
    const next = addDays(zoned, direction * 7);
    return fromZonedTime(`${format(next, "yyyy-MM-dd")}T12:00:00`, timeZone);
  }
  const next = new Date(zoned);
  next.setMonth(zoned.getMonth() + direction);
  return fromZonedTime(`${format(next, "yyyy-MM-dd")}T12:00:00`, timeZone);
}

export function titleForRange(
  view: CalendarView,
  anchor: Date,
  locale: string,
  timeZone = CLINIC_TIMEZONE,
): string {
  if (view === "day") {
    return formatClinicDate(anchor, "d MMMM yyyy", locale, timeZone);
  }
  if (view === "week") {
    const { rangeStart, rangeEnd } = rangeForView(view, anchor, timeZone);
    const endInclusive = addMinutes(rangeEnd, -1);
    return `${formatClinicDate(rangeStart, "d MMM", locale, timeZone)} – ${formatClinicDate(endInclusive, "d MMM yyyy", locale, timeZone)}`;
  }
  return formatClinicDate(anchor, "LLLL yyyy", locale, timeZone);
}
