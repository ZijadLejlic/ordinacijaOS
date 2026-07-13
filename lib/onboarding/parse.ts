import type { Json } from "@/lib/supabase/database.types";

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type WorkingHours = Record<Weekday, DayHours>;

export type OnboardingSteps = {
  clinic: boolean;
  services: boolean;
  invite: boolean;
};

export type OnboardingState = {
  /** True when wizard finished (or clinic grandfathered before Faza 2I). */
  completed: boolean;
  step: 1 | 2 | 3;
  steps: OnboardingSteps;
  completedAt: string | null;
  skippedInvite: boolean;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultWorkingHours(): WorkingHours {
  const weekday: DayHours = { closed: false, open: "08:00", close: "16:00" };
  const saturday: DayHours = { closed: false, open: "09:00", close: "13:00" };
  const sunday: DayHours = { closed: true, open: "09:00", close: "13:00" };
  return {
    monday: { ...weekday },
    tuesday: { ...weekday },
    wednesday: { ...weekday },
    thursday: { ...weekday },
    friday: { ...weekday },
    saturday: { ...saturday },
    sunday: { ...sunday },
  };
}

function parseDayHours(value: unknown, fallback: DayHours): DayHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback };
  }
  const raw = value as Record<string, unknown>;
  const closed = Boolean(raw.closed);
  const open =
    typeof raw.open === "string" && TIME_RE.test(raw.open)
      ? raw.open
      : fallback.open;
  const close =
    typeof raw.close === "string" && TIME_RE.test(raw.close)
      ? raw.close
      : fallback.close;
  return { closed, open, close };
}

export function parseWorkingHours(settings: unknown): WorkingHours {
  const defaults = defaultWorkingHours();
  const root =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const hoursRaw = root.working_hours;
  if (!hoursRaw || typeof hoursRaw !== "object" || Array.isArray(hoursRaw)) {
    return defaults;
  }
  const hours = hoursRaw as Record<string, unknown>;
  const next = { ...defaults };
  for (const day of WEEKDAYS) {
    next[day] = parseDayHours(hours[day], defaults[day]);
  }
  return next;
}

export function workingHoursToJson(hours: WorkingHours): Json {
  const out: Record<string, DayHours> = {};
  for (const day of WEEKDAYS) {
    out[day] = {
      closed: hours[day].closed,
      open: hours[day].open,
      close: hours[day].close,
    };
  }
  return out as Json;
}

/**
 * Parse onboarding progress from clinics.settings_json.
 * Missing `onboarding` key → grandfathered completed (pre-2I clinics).
 */
export function parseOnboardingState(settings: unknown): OnboardingState {
  const root =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};

  const raw = root.onboarding;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      completed: true,
      step: 3,
      steps: { clinic: true, services: true, invite: true },
      completedAt: null,
      skippedInvite: false,
    };
  }

  const ob = raw as Record<string, unknown>;
  const stepsRaw =
    ob.steps && typeof ob.steps === "object" && !Array.isArray(ob.steps)
      ? (ob.steps as Record<string, unknown>)
      : {};

  const stepNum = typeof ob.step === "number" ? ob.step : 1;
  const step: 1 | 2 | 3 = stepNum === 2 ? 2 : stepNum === 3 ? 3 : 1;

  return {
    completed: Boolean(ob.completed),
    step,
    steps: {
      clinic: Boolean(stepsRaw.clinic),
      services: Boolean(stepsRaw.services),
      invite: Boolean(stepsRaw.invite),
    },
    completedAt: typeof ob.completed_at === "string" ? ob.completed_at : null,
    skippedInvite: Boolean(ob.skipped_invite),
  };
}

export function onboardingToJson(state: OnboardingState): Json {
  return {
    completed: state.completed,
    step: state.step,
    steps: {
      clinic: state.steps.clinic,
      services: state.steps.services,
      invite: state.steps.invite,
    },
    ...(state.completedAt ? { completed_at: state.completedAt } : {}),
    ...(state.skippedInvite ? { skipped_invite: true } : {}),
  };
}

export function needsOnboarding(settings: unknown): boolean {
  return !parseOnboardingState(settings).completed;
}
