import { describe, expect, it } from "vitest";
import {
  CLINIC_TIMEZONE,
  daysInRange,
  formatClinicDate,
  formatDateKey,
  parseAnchorDate,
  parseView,
  rangeForView,
} from "@/lib/calendar/time";

describe("calendar time ranges", () => {
  it("defaults to week view", () => {
    expect(parseView(undefined)).toBe("week");
    expect(parseView("nope")).toBe("week");
    expect(parseView("day")).toBe("day");
  });

  it("day range is one clinic-local day", () => {
    const anchor = parseAnchorDate("2026-07-13");
    const { rangeStart, rangeEnd } = rangeForView("day", anchor);
    const days = daysInRange(rangeStart, rangeEnd);
    expect(days.map((d) => formatDateKey(d, CLINIC_TIMEZONE))).toEqual([
      "2026-07-13",
    ]);
  });

  it("week range is Mon–Sun", () => {
    const anchor = parseAnchorDate("2026-07-15"); // Wednesday
    const { rangeStart, rangeEnd } = rangeForView("week", anchor);
    const days = daysInRange(rangeStart, rangeEnd);
    expect(days).toHaveLength(7);
    expect(formatDateKey(days[0]!, CLINIC_TIMEZONE)).toBe("2026-07-13");
    expect(formatDateKey(days[6]!, CLINIC_TIMEZONE)).toBe("2026-07-19");
  });
});

describe("formatClinicDate", () => {
  // 10:00 UTC = 12:00 Europe/Sarajevo (CEST)
  const noonish = "2026-07-13T10:00:00.000Z";

  it("formats clinic-local time for Date and ISO string", () => {
    expect(formatClinicDate(noonish, "HH:mm", "en")).toBe("12:00");
    expect(formatClinicDate(new Date(noonish), "HH:mm", "bs")).toBe("12:00");
  });

  it("uses the active UI locale for day labels", () => {
    const day = parseAnchorDate("2026-07-13");
    expect(formatClinicDate(day, "EEEE", "en")).toBe("Monday");
    expect(formatClinicDate(day, "EEEE", "bs").toLowerCase()).toContain("pon");
  });
});
