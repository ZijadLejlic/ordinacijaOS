import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
type ClinicStatus = Database["public"]["Enums"]["clinic_status"];

export type ClinicContextProfile = {
  id: string;
  full_name: string;
  role: AppRole;
  clinic_id: string;
  is_active: boolean;
};

export type ClinicContextClinic = {
  name: string;
  branding_json: Json;
  status: ClinicStatus;
  grace_ends_at: string | null;
  is_demo: boolean;
  trial_ends_at: string | null;
  timezone: string;
  settings_json: Json;
};

export type ClinicContext = {
  user: User;
  profile: ClinicContextProfile;
  clinic: ClinicContextClinic | null;
};

/**
 * Request-scoped clinic membership (React.cache).
 * Layout + pages share one profiles(+clinics) round-trip per navigation.
 */
export const getClinicContext = cache(async (): Promise<ClinicContext | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, clinic_id, is_active, clinics(name, branding_json, status, grace_ends_at, is_demo, trial_ends_at, timezone, settings_json)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const clinicRaw = profile.clinics as ClinicContextClinic | ClinicContextClinic[] | null;
  const clinic = Array.isArray(clinicRaw) ? (clinicRaw[0] ?? null) : clinicRaw;

  return {
    user,
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      clinic_id: profile.clinic_id,
      is_active: profile.is_active,
    },
    clinic,
  };
});
