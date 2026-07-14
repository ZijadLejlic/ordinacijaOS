import { describe, expect, it } from "vitest";
import { nextBirthdayDueOn } from "@/lib/crm/generate";

describe("nextBirthdayDueOn", () => {
  it("returns birthday within window", () => {
    expect(nextBirthdayDueOn("1990-07-16", "2026-07-14")).toBe("2026-07-16");
  });

  it("returns null when outside window", () => {
    expect(nextBirthdayDueOn("1990-08-01", "2026-07-14")).toBeNull();
  });

  it("rolls to next year when birthday already passed", () => {
    expect(nextBirthdayDueOn("1990-01-05", "2026-12-30")).toBe("2027-01-05");
  });
});
