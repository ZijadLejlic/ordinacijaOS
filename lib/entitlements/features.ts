import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** PRD §4.3 feature keys — source of truth is `plan_entitlements`. */
export const FEATURE_KEYS = [
  "patients_chart",
  "odontogram",
  "treatment_plan",
  "calendar_basic",
  "calendar_advanced",
  "invoices",
  "expenses_reports_excel",
  "installments_calculator",
  "email_reminders",
  "branding_custom",
  "crm_light",
  "waitlist_auto",
  "consent_draw_sign",
  "inventory_basic",
  "sms_whatsapp",
  "ai_copilot",
  "patient_portal",
  "mini_website",
  "online_booking",
  "lab_technician",
  "marketing_campaigns",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Free period 2026 (D3/D4): Professional entitlements minus these,
 * even if the plan matrix has them enabled (e.g. metered SMS).
 * Stripe billing starts 2027-01-01 (D5).
 */
export const FREE_PERIOD_DISABLED_FEATURES = [
  "sms_whatsapp",
  "ai_copilot",
  "patient_portal",
] as const satisfies readonly FeatureKey[];

export const BILLING_START = new Date("2027-01-01T00:00:00+01:00");

export type FeatureFlag = {
  key: FeatureKey;
  enabled: boolean;
  is_metered: boolean;
};

export type ClinicEntitlements = {
  clinicId: string;
  planId: string;
  planCode: string;
  features: Record<FeatureKey, FeatureFlag>;
  freePeriodOverride: boolean;
};

export function isFreePeriod2026(now: Date = new Date()): boolean {
  return now < BILLING_START;
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

/**
 * Apply PRD free-period overrides on top of plan matrix rows.
 */
export function applyFreePeriodOverrides(
  features: Record<FeatureKey, FeatureFlag>,
  now: Date = new Date(),
): { features: Record<FeatureKey, FeatureFlag>; freePeriodOverride: boolean } {
  const freePeriodOverride = isFreePeriod2026(now);
  if (!freePeriodOverride) {
    return { features, freePeriodOverride: false };
  }

  const next = { ...features };
  for (const key of FREE_PERIOD_DISABLED_FEATURES) {
    next[key] = { ...next[key], enabled: false };
  }
  return { features: next, freePeriodOverride: true };
}

function emptyFeatures(): Record<FeatureKey, FeatureFlag> {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, { key, enabled: false, is_metered: false }]),
  ) as Record<FeatureKey, FeatureFlag>;
}

/**
 * Load clinic plan feature matrix + free-period overrides (D42 / §4.3).
 */
export async function getClinicEntitlements(
  supabase: Client,
  clinicId: string,
  now: Date = new Date(),
): Promise<ClinicEntitlements> {
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, plan_id, plans(id, code)")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    throw new Error(clinicError?.message ?? "Clinic not found");
  }

  const plan = clinic.plans as { id: string; code: string } | null;
  if (!plan) {
    throw new Error("Clinic has no plan");
  }

  const { data: rows, error: entError } = await supabase
    .from("plan_entitlements")
    .select("feature_key, enabled, is_metered")
    .eq("plan_id", plan.id);

  if (entError) {
    throw new Error(entError.message);
  }

  const features = emptyFeatures();
  for (const row of rows ?? []) {
    if (!isFeatureKey(row.feature_key)) continue;
    features[row.feature_key] = {
      key: row.feature_key,
      enabled: row.enabled,
      is_metered: row.is_metered,
    };
  }

  const applied = applyFreePeriodOverrides(features, now);

  return {
    clinicId: clinic.id,
    planId: plan.id,
    planCode: plan.code,
    features: applied.features,
    freePeriodOverride: applied.freePeriodOverride,
  };
}

export async function clinicHasFeature(
  supabase: Client,
  clinicId: string,
  feature: FeatureKey,
  now: Date = new Date(),
): Promise<boolean> {
  const entitlements = await getClinicEntitlements(supabase, clinicId, now);
  return entitlements.features[feature].enabled;
}

export type FeatureCheck =
  | { ok: true; entitlements: ClinicEntitlements }
  | {
      ok: false;
      code: "featureDisabled";
      feature: FeatureKey;
      entitlements: ClinicEntitlements;
    };

export async function assertFeature(
  supabase: Client,
  clinicId: string,
  feature: FeatureKey,
  now: Date = new Date(),
): Promise<FeatureCheck> {
  const entitlements = await getClinicEntitlements(supabase, clinicId, now);
  if (!entitlements.features[feature].enabled) {
    return {
      ok: false,
      code: "featureDisabled",
      feature,
      entitlements,
    };
  }
  return { ok: true, entitlements };
}
