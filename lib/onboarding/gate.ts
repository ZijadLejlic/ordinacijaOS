import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { canAccessOnboarding } from "@/lib/onboarding/rbac";
import { needsOnboarding } from "@/lib/onboarding/parse";

type Client = SupabaseClient<Database>;

export type OnboardingGate = "ok" | "needs_onboarding" | "forbidden";

/**
 * Owner with incomplete onboarding → needs_onboarding.
 * Non-owners and grandfathered/completed clinics → ok.
 * Unauthenticated / inactive → forbidden.
 */
export async function resolveOnboardingGate(
  supabase: Client,
): Promise<OnboardingGate> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "forbidden";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, clinic_id, clinics(settings_json)")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) return "forbidden";
  if (!canAccessOnboarding(profile.role)) return "ok";

  const clinic = profile.clinics as { settings_json: unknown } | null;
  if (needsOnboarding(clinic?.settings_json)) {
    return "needs_onboarding";
  }
  return "ok";
}
