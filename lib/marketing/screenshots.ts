import type { TourPreviewKind } from "@/lib/marketing/tour";

/** §5.3 WebP paths under `public/marketing/screenshots/`. */
export const MARKETING_SHOT_IDS = [
  "signup",
  "onboarding-1",
  "onboarding-2",
  "onboarding-3",
  "patients",
  "chart",
  "odontogram",
  "plan",
  "calendar",
  "appointment-modal",
  "waitlist",
  "invoice",
  "payments",
  "reports",
  "dashboard",
  "crm",
  "inventory",
  "settings",
  "reminder",
  "mobile-calendar",
  "mobile-chart",
] as const;

export type MarketingShotId = (typeof MARKETING_SHOT_IDS)[number];

export const TOUR_PREVIEW_TO_SHOT: Record<TourPreviewKind, MarketingShotId> = {
  signup: "signup",
  mfa: "signup",
  onboarding: "onboarding-1",
  services: "onboarding-2",
  team: "onboarding-3",
  patients: "patients",
  chart: "chart",
  odontogram: "odontogram",
  plan: "plan",
  calendar: "calendar",
  reminder: "reminder",
  waitlist: "waitlist",
  invoice: "invoice",
  payments: "payments",
  reports: "reports",
  dashboard: "dashboard",
  crm: "crm",
  inventory: "inventory",
  settings: "settings",
};

export function marketingShotSrc(id: MarketingShotId): string {
  return `/marketing/screenshots/${id}.webp`;
}

export function tourShotSrc(kind: TourPreviewKind): string {
  return marketingShotSrc(TOUR_PREVIEW_TO_SHOT[kind]);
}
