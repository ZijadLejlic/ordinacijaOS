import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §6.1 — In-app onboarding is owner-only. */
export function canAccessOnboarding(role: AppRole): boolean {
  return role === "owner";
}

/** Step 3 invite roles from PRD: doctor or reception. */
export const onboardingInviteRoles = ["doctor", "reception"] as const;
export type OnboardingInviteRole = (typeof onboardingInviteRoles)[number];
