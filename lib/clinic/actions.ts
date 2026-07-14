"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { canManagePrivacy } from "@/lib/privacy/rbac";
import { createClient } from "@/lib/supabase/server";

export type ClinicLifecycleActionState = {
  error?: string;
  message?: string;
  graceEndsAt?: string;
} | null;

/**
 * Owner requests account closure (D45): readonly + 7-day grace → cron hard delete.
 * Export ZIP remains available during grace.
 */
export async function requestClinicClosureAction(): Promise<ClinicLifecycleActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canManagePrivacy(profile.role)) {
    return { error: "forbidden" };
  }

  const { data, error } = await supabase.rpc("request_clinic_closure");

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("mfa_required")) return { error: "mfaRequired" };
    if (msg.includes("already_closing")) return { error: "alreadyClosing" };
    if (msg.includes("not_active")) return { error: "notActive" };
    if (msg.includes("forbidden")) return { error: "forbidden" };
    return { error: "closureFailed" };
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { grace_ends_at?: string })
      : {};

  const locale = await getLocale();
  revalidatePath(`/${locale}/settings/privacy`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/settings/audit`);

  return {
    message: "closureStarted",
    graceEndsAt:
      typeof payload.grace_ends_at === "string" ? payload.grace_ends_at : undefined,
  };
}
