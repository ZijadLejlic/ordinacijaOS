import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 — Import CSV: owner (pacijenti + usluge); accountant (usluge). */

export function canAccessImport(role: AppRole): boolean {
  return role === "owner" || role === "accountant";
}

export function canImportPatients(role: AppRole): boolean {
  return role === "owner";
}

export function canImportServices(role: AppRole): boolean {
  return role === "owner" || role === "accountant";
}
