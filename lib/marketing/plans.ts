import { FEATURE_KEYS, type FeatureKey } from "@/lib/entitlements/features";

/** Public pricing display — mirrors PRD §4.1–4.3 / seeded `plans` (D42). */
export type MarketingPlanCode =
  | "starter"
  | "professional"
  | "premium_ai"
  | "enterprise";

/** Cell in the public feature matrix (PRD §4.3). */
export type MarketingFeatureAvailability = "yes" | "no" | "metered";

export type MarketingPlan = {
  code: MarketingPlanCode;
  /** Monthly EUR with VAT; null = “from” Enterprise floor. */
  priceMonthly: number | null;
  highlighted: boolean;
  limits: {
    doctors: number | null;
    users: number | null;
    locations: number | null;
    imagesPerPatient: number;
  };
  /** 5–7 feature keys shown on the plan card (PRD §4.3). */
  highlightFeatures: FeatureKey[];
};

export const MARKETING_PLAN_CODES = [
  "starter",
  "professional",
  "premium_ai",
  "enterprise",
] as const satisfies readonly MarketingPlanCode[];

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    code: "starter",
    priceMonthly: 15,
    highlighted: false,
    limits: {
      doctors: 2,
      users: 3,
      locations: 1,
      imagesPerPatient: 10,
    },
    highlightFeatures: [
      "patients_chart",
      "odontogram",
      "treatment_plan",
      "calendar_basic",
      "invoices",
      "email_reminders",
    ],
  },
  {
    code: "professional",
    priceMonthly: 25,
    highlighted: true,
    limits: {
      doctors: 5,
      users: 10,
      locations: 2,
      imagesPerPatient: 20,
    },
    highlightFeatures: [
      "calendar_advanced",
      "expenses_reports_excel",
      "installments_calculator",
      "branding_custom",
      "crm_light",
      "waitlist_auto",
      "inventory_basic",
    ],
  },
  {
    code: "premium_ai",
    priceMonthly: 35,
    highlighted: false,
    limits: {
      doctors: 10,
      users: 25,
      locations: 5,
      imagesPerPatient: 30,
    },
    highlightFeatures: [
      "calendar_advanced",
      "expenses_reports_excel",
      "inventory_basic",
      "crm_light",
      "ai_copilot",
      "consent_draw_sign",
      "branding_custom",
    ],
  },
  {
    code: "enterprise",
    priceMonthly: null,
    highlighted: false,
    limits: {
      doctors: null,
      users: null,
      locations: null,
      imagesPerPatient: 40,
    },
    highlightFeatures: [
      "patient_portal",
      "mini_website",
      "online_booking",
      "lab_technician",
      "marketing_campaigns",
      "ai_copilot",
      "inventory_basic",
    ],
  },
];

/**
 * Full public matrix — must match PRD §4.3 (do not invent deviations).
 * `metered` = available as metered add-on (SMS/WhatsApp, AI).
 */
export const MARKETING_FEATURE_MATRIX: Record<
  FeatureKey,
  Record<MarketingPlanCode, MarketingFeatureAvailability>
> = {
  patients_chart: {
    starter: "yes",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  odontogram: {
    starter: "yes",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  treatment_plan: {
    starter: "yes",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  calendar_basic: {
    starter: "yes",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  calendar_advanced: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  invoices: {
    starter: "yes",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  expenses_reports_excel: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  installments_calculator: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  email_reminders: {
    starter: "yes",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  branding_custom: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  crm_light: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  waitlist_auto: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  consent_draw_sign: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  inventory_basic: {
    starter: "no",
    professional: "yes",
    premium_ai: "yes",
    enterprise: "yes",
  },
  sms_whatsapp: {
    starter: "no",
    professional: "metered",
    premium_ai: "metered",
    enterprise: "metered",
  },
  ai_copilot: {
    starter: "no",
    professional: "no",
    premium_ai: "metered",
    enterprise: "metered",
  },
  patient_portal: {
    starter: "no",
    professional: "no",
    premium_ai: "no",
    enterprise: "yes",
  },
  mini_website: {
    starter: "no",
    professional: "no",
    premium_ai: "no",
    enterprise: "yes",
  },
  online_booking: {
    starter: "no",
    professional: "no",
    premium_ai: "no",
    enterprise: "yes",
  },
  lab_technician: {
    starter: "no",
    professional: "no",
    premium_ai: "no",
    enterprise: "yes",
  },
  marketing_campaigns: {
    starter: "no",
    professional: "no",
    premium_ai: "no",
    enterprise: "yes",
  },
};

/** Ordered rows for the comparison table — same order as PRD §4.3. */
export const MARKETING_FEATURE_ROWS = FEATURE_KEYS.map((key) => ({
  key,
  availability: MARKETING_FEATURE_MATRIX[key],
}));

export function getMarketingPlan(code: MarketingPlanCode): MarketingPlan {
  const plan = MARKETING_PLANS.find((p) => p.code === code);
  if (!plan) throw new Error(`Unknown marketing plan: ${code}`);
  return plan;
}

/**
 * True when the feature is absent on Starter and included on Professional
 * (PRD §4.3) — used for public “Pro” badges (do not hardcode deviations).
 */
export function isProfessionalFeature(key: FeatureKey): boolean {
  const row = MARKETING_FEATURE_MATRIX[key];
  return row.starter === "no" && row.professional === "yes";
}
