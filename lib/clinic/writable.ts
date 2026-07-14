import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type ClinicStatus = Database["public"]["Enums"]["clinic_status"];

export const CLINIC_GRACE_DAYS = 7;

export type ClinicWriteBlockError =
  | "clinicReadonly"
  | "clinicPendingDelete";

/** True when mutations are allowed (status = active). */
export function clinicIsWritable(status: ClinicStatus | null | undefined) {
  return status === "active";
}

export function clinicWriteBlockError(
  status: ClinicStatus | null | undefined,
): ClinicWriteBlockError | null {
  if (!status || status === "active") return null;
  if (status === "pending_delete") return "clinicPendingDelete";
  return "clinicReadonly";
}

/**
 * App-layer guard for Server Actions (friendly errors).
 * RLS `clinic_is_writable()` is the source of truth for writes.
 */
export async function getClinicWriteBlock(
  supabase: Client,
  clinicId: string,
): Promise<ClinicWriteBlockError | null> {
  const { data } = await supabase
    .from("clinics")
    .select("status")
    .eq("id", clinicId)
    .maybeSingle();

  return clinicWriteBlockError(data?.status);
}

export type ClinicLifecycleInfo = {
  status: ClinicStatus;
  graceEndsAt: string | null;
  readonlyStartedAt: string | null;
  closureReason: string | null;
  trialEndsAt: string | null;
};

export async function getClinicLifecycle(
  supabase: Client,
  clinicId: string,
): Promise<ClinicLifecycleInfo | null> {
  const { data } = await supabase
    .from("clinics")
    .select(
      "status, grace_ends_at, readonly_started_at, closure_reason, trial_ends_at",
    )
    .eq("id", clinicId)
    .maybeSingle();

  if (!data) return null;

  return {
    status: data.status,
    graceEndsAt: data.grace_ends_at,
    readonlyStartedAt: data.readonly_started_at,
    closureReason: data.closure_reason,
    trialEndsAt: data.trial_ends_at,
  };
}
