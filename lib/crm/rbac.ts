import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 — CRM notifikacije: owner + reception. */

export function canAccessCrm(role: AppRole): boolean {
  return role === "owner" || role === "reception";
}

export function canSendCrmMessages(role: AppRole): boolean {
  return canAccessCrm(role);
}
