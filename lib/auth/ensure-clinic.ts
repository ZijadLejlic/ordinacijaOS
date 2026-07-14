import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

function isProfileAlreadyExists(message: string | undefined) {
  return (message ?? "").toLowerCase().includes("profile already exists");
}

/**
 * After auth signup/login: if the user has no profile yet, create clinic + owner
 * via SECURITY DEFINER RPC (PRD §6.1 / D4).
 *
 * Note: owners with verified MFA are on aal1 until TOTP verify, so `profiles`
 * SELECT is blocked by restrictive `owner_mfa_ok` RLS. Treat "already exists"
 * from the definer RPC as success (idempotent ensure).
 */
export async function ensureOwnerClinic(
  supabase: Client,
  opts: { clinicName: string; fullName: string },
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: userError?.message ?? "Not authenticated" } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message } as const;
  }

  if (profile) {
    return { clinicId: null as string | null, created: false } as const;
  }

  const { data: clinicId, error: rpcError } = await supabase.rpc(
    "create_clinic_for_owner",
    {
      p_clinic_name: opts.clinicName,
      p_full_name: opts.fullName,
    },
  );

  if (rpcError) {
    // Profile exists but SELECT was hidden by MFA aal1 RLS — login should continue.
    if (isProfileAlreadyExists(rpcError.message)) {
      return { clinicId: null as string | null, created: false } as const;
    }
    return { error: rpcError.message } as const;
  }

  return { clinicId, created: true } as const;
}
