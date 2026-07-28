import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * PRD §3.2 / D53 — Fakture / uplate: owner, accountant, doctor.
 * Rashodi / Excel i legal invoice settings ostaju owner(+accountant za rashode).
 */
export function canAccessInvoices(role: AppRole): boolean {
  return (
    role === "owner" || role === "accountant" || role === "doctor"
  );
}

export function canWriteInvoices(role: AppRole): boolean {
  return canAccessInvoices(role);
}
