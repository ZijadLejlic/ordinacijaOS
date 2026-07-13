import { describe, expect, it } from "vitest";
import {
  CLINIC_TIMEZONE,
  daysInRange,
  formatDateKey,
  parseAnchorDate,
  rangeForView,
} from "@/lib/calendar/time";

describe("calendar time ranges", () => {
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
