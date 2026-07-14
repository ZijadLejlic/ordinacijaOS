"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDemoCredentials } from "@/lib/demo/config";
import { clearOperatorCookie } from "@/lib/operators/session";
import { clearImpersonationCookie } from "@/lib/platform/session";
import { createClient } from "@/lib/supabase/server";

export type OpenDemoState = {
  error?: "unavailable" | "failed";
} | null;

/**
 * Sign the visitor into the read-only marketing demo clinic (W8).
 * Credentials live in env — never expose to the client.
 */
export async function openDemoClinicAction(
  _prev: OpenDemoState,
  formData: FormData,
): Promise<OpenDemoState> {
  void formData;
  const credentials = getDemoCredentials();
  if (!credentials) {
    return { error: "unavailable" };
  }

  const supabase = await createClient();
  const locale = await getLocale();

  await clearOperatorCookie();
  await clearImpersonationCookie();
  await supabase.auth.signOut();

  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    console.error("[demo] sign-in failed", error.message);
    return { error: "failed" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "failed" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, clinics(is_demo, status)")
    .eq("id", user.id)
    .maybeSingle();

  const clinic = profile?.clinics as
    | { is_demo: boolean; status: string }
    | null
    | undefined;

  if (!clinic?.is_demo) {
    await supabase.auth.signOut();
    console.error("[demo] signed-in user is not the demo clinic");
    return { error: "failed" };
  }

  redirect({ href: "/dashboard", locale });
  return null;
}
