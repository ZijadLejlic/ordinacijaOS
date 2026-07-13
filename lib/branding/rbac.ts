import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Owner manages branding (PRD §3.2 / §6.13). */
export function canManageBranding(role: AppRole): boolean {
  return role === "owner";
}
