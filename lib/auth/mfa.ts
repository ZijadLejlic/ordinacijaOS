import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type MfaGate = "ok" | "enroll" | "verify";

/**
 * D11: Owner must use TOTP. Staff never required.
 * - no verified factor → enroll
 * - verified factor but session is aal1 → verify
 * - aal2 (or non-owner) → ok
 */
export async function resolveOwnerMfaGate(supabase: Client): Promise<MfaGate> {
  const { data: isOwner, error: ownerError } =
    await supabase.rpc("is_clinic_owner");

  if (ownerError || !isOwner) {
    return "ok";
  }

  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();

  if (factorsError) {
    return "enroll";
  }

  const hasVerifiedTotp = (factors.totp ?? []).some(
    (f) => f.status === "verified",
  );

  if (!hasVerifiedTotp) {
    return "enroll";
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || aal.currentLevel !== "aal2") {
    return "verify";
  }

  return "ok";
}

export function mfaPath(gate: Exclude<MfaGate, "ok">) {
  return gate === "enroll" ? "/mfa/enroll" : "/mfa/verify";
}

/**
 * GoTrue requires AAL2 to change email/password when a verified MFA factor
 * exists (any role). Recovery/login sessions start at AAL1 until TOTP step-up.
 */
export async function needsMfaStepUpForSensitiveAuth(
  supabase: Client,
): Promise<boolean> {
  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError) return false;

  const hasVerifiedTotp = (factors.totp ?? []).some(
    (f) => f.status === "verified",
  );
  if (!hasVerifiedTotp) return false;

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) return true;

  return aal.currentLevel !== "aal2";
}

const MFA_NEXT_ALLOWLIST = new Set([
  "/dashboard",
  "/reset-password",
  "/onboarding",
  "/platform",
  "/login",
]);

/** Allow only same-app relative paths for post-MFA redirects. */
export function safeMfaNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return null;
  }
  // Strip accidental locale prefix from absolute public paths.
  const stripped = raw.replace(/^\/(bs|hr|sr|en)(?=\/)/, "");
  if (!MFA_NEXT_ALLOWLIST.has(stripped)) {
    return null;
  }
  return stripped;
}
