import { describe, expect, it } from "vitest";
import {
  defaultWorkingHours,
  needsOnboarding,
  parseOnboardingState,
  parseWorkingHours,
  workingHoursToJson,
} from "@/lib/onboarding/parse";

describe("parseOnboardingState", () => {
  it("grandfathers clinics without onboarding key as completed", () => {
    const state = parseOnboardingState({});
    expect(state.completed).toBe(true);
    expect(needsOnboarding({})).toBe(false);
  });

  it("reads incomplete onboarding from settings_json", () => {
    const state = parseOnboardingState({
      onboarding: {
        completed: false,
        step: 2,
        steps: { clinic: true, services: false, invite: false },
      },
    });
    expect(state.completed).toBe(false);
    expect(state.step).toBe(2);
    expect(state.steps.clinic).toBe(true);
    expect(needsOnboarding({ onboarding: { completed: false } })).toBe(true);
  });

  it("reads completed_at and skipped_invite", () => {
    const state = parseOnboardingState({
      onboarding: {
        completed: true,
        step: 3,
        steps: { clinic: true, services: true, invite: true },
        completed_at: "2026-07-13T12:00:00.000Z",
        skipped_invite: true,
      },
    });
    expect(state.completedAt).toBe("2026-07-13T12:00:00.000Z");
    expect(state.skippedInvite).toBe(true);
  });
});

describe("parseWorkingHours", () => {
  it("returns defaults when missing", () => {
    const hours = parseWorkingHours({});
    expect(hours.monday.open).toBe("08:00");
    expect(hours.sunday.closed).toBe(true);
  });

  it("merges partial day overrides", () => {
    const hours = parseWorkingHours({
      working_hours: {
        monday: { closed: false, open: "09:00", close: "17:00" },
        sunday: { closed: false, open: "10:00", close: "12:00" },
      },
    });
    expect(hours.monday.open).toBe("09:00");
    expect(hours.sunday.closed).toBe(false);
    expect(hours.tuesday.open).toBe("08:00");
  });

  it("round-trips via workingHoursToJson", () => {
    const defaults = defaultWorkingHours();
    const json = workingHoursToJson(defaults);
    const parsed = parseWorkingHours({ working_hours: json });
    expect(parsed.friday.close).toBe(defaults.friday.close);
  });
});
