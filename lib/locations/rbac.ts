import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Owner manages locations + clinic pricelist setting (D16). */
export function canManageLocations(role: AppRole): boolean {
  return role === "owner";
}

/** All clinic members can read locations (calendar / services / invoices). */
export function canReadLocations(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "assistant" ||
    role === "reception" ||
    role === "accountant" ||
    role === "technician"
  );
}
