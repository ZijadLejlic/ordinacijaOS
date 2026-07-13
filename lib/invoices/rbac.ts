import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 — Fakture / uplate: owner + accountant only. */
export function canAccessInvoices(role: AppRole): boolean {
  return role === "owner" || role === "accountant";
}

export function canWriteInvoices(role: AppRole): boolean {
  return canAccessInvoices(role);
}
