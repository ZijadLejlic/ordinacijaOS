import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type AppRole = Database["public"]["Enums"]["app_role"];

export type PlanLimits = {
  users: number | null;
  doctors: number | null;
  locations: number | null;
  images_per_patient: number | null;
};

export type LimitCheck =
  | { ok: true; limits: PlanLimits; usage: { users: number; doctors: number } }
  | {
      ok: false;
      code: "userLimit" | "doctorLimit";
      limits: PlanLimits;
      usage: { users: number; doctors: number };
    };

function asLimit(value: Json | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function parseLimitsJson(limitsJson: Json): PlanLimits {
  const obj =
    limitsJson && typeof limitsJson === "object" && !Array.isArray(limitsJson)
      ? limitsJson
      : {};

  return {
    users: asLimit(obj.users),
    doctors: asLimit(obj.doctors),
    locations: asLimit(obj.locations),
    images_per_patient: asLimit(obj.images_per_patient),
  };
}

/**
 * Hard-block plan limits before invite (D8 / D42).
 * Counts active profiles + pending invites as reserved seats.
 */
export async function assertCanInviteStaff(
  supabase: Client,
  clinicId: string,
  role: AppRole,
): Promise<LimitCheck> {
  await supabase.rpc("expire_stale_clinic_invites", {
    p_clinic_id: clinicId,
  });

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("plan_id, plans(limits_json)")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    throw new Error(clinicError?.message ?? "Clinic not found");
  }

  const plan = clinic.plans as { limits_json: Json } | null;
  const limits = parseLimitsJson(plan?.limits_json ?? {});

  const [{ data: profiles }, { data: invites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, is_active")
      .eq("clinic_id", clinicId),
    supabase
      .from("clinic_invites")
      .select("role, status")
      .eq("clinic_id", clinicId)
      .eq("status", "pending"),
  ]);

  const activeProfiles = (profiles ?? []).filter((p) => p.is_active);
  const pendingInvites = invites ?? [];

  const users =
    activeProfiles.length + pendingInvites.length;
  const doctors =
    activeProfiles.filter((p) => p.role === "doctor").length +
    pendingInvites.filter((i) => i.role === "doctor").length;

  const usage = { users, doctors };

  if (limits.users !== null && users >= limits.users) {
    return { ok: false, code: "userLimit", limits, usage };
  }

  if (
    role === "doctor" &&
    limits.doctors !== null &&
    doctors >= limits.doctors
  ) {
    return { ok: false, code: "doctorLimit", limits, usage };
  }

  return { ok: true, limits, usage };
}
