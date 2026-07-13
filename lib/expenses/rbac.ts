import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 — Rashodi / Excel: owner + accountant only. */
export function canAccessExpenses(role: AppRole): boolean {
  return role === "owner" || role === "accountant";
}

export function canWriteExpenses(role: AppRole): boolean {
  return canAccessExpenses(role);
}
