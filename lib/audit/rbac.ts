import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §6.15 — owner-only audit log UI. */
export function canViewAuditLog(role: AppRole): boolean {
  return role === "owner";
}
