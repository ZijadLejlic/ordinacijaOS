/** Product tour chapters/steps (Website §5). Preview keys drive CSS mock layouts. */

export type TourPreviewKind =
  | "signup"
  | "onboarding"
  | "services"
  | "team"
  | "patients"
  | "chart"
  | "odontogram"
  | "plan"
  | "calendar"
  | "reminder"
  | "waitlist"
  | "invoice"
  | "payments"
  | "reports"
  | "dashboard"
  | "crm"
  | "inventory"
  | "settings";

export type TourStepDef = {
  id: string;
  preview: TourPreviewKind;
  annotations?: number;
};

export type TourChapterId =
  | "signup"
  | "setup"
  | "patient"
  | "appointments"
  | "billing"
  | "daily";

export type TourChapterDef = {
  id: TourChapterId;
  minutes: number;
  steps: TourStepDef[];
};

export const TOUR_CHAPTERS: readonly TourChapterDef[] = [
  {
    id: "signup",
    minutes: 2,
    steps: [
      { id: "register", preview: "signup", annotations: 2 },
      { id: "confirm", preview: "signup" },
    ],
  },
  {
    id: "setup",
    minutes: 5,
    steps: [
      { id: "basics", preview: "onboarding", annotations: 2 },
      { id: "services", preview: "services", annotations: 2 },
      { id: "team", preview: "team", annotations: 2 },
    ],
  },
  {
    id: "patient",
    minutes: 3,
    steps: [
      { id: "newPatient", preview: "patients", annotations: 2 },
      { id: "chart", preview: "chart", annotations: 2 },
      { id: "odontogram", preview: "odontogram", annotations: 3 },
      { id: "plan", preview: "plan", annotations: 2 },
    ],
  },
  {
    id: "appointments",
    minutes: 2,
    steps: [
      { id: "calendar", preview: "calendar", annotations: 2 },
      { id: "reminder", preview: "reminder" },
      { id: "waitlist", preview: "waitlist", annotations: 2 },
    ],
  },
  {
    id: "billing",
    minutes: 3,
    steps: [
      { id: "invoice", preview: "invoice", annotations: 2 },
      { id: "payments", preview: "payments", annotations: 2 },
      { id: "reports", preview: "reports", annotations: 2 },
    ],
  },
  {
    id: "daily",
    minutes: 2,
    steps: [
      { id: "dashboard", preview: "dashboard", annotations: 3 },
      { id: "crm", preview: "crm", annotations: 2 },
      { id: "inventory", preview: "inventory", annotations: 2 },
      { id: "settings", preview: "settings", annotations: 2 },
    ],
  },
];

export const TOUR_STEP_IDS = TOUR_CHAPTERS.flatMap((c) =>
  c.steps.map((s) => s.id),
);

export const DEMO_GALLERY_KEYS = [
  "dashboard",
  "patients",
  "odontogram",
  "calendar",
  "invoice",
  "crm",
  "inventory",
  "settings",
] as const;

export type DemoGalleryKey = (typeof DEMO_GALLERY_KEYS)[number];
