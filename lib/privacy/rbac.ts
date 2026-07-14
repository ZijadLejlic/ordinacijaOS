import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §8.2 / D35 — privacy export + GDPR erasure. */
export function canManagePrivacy(role: AppRole): boolean {
  return role === "owner";
}

/** Staff who can request patient erasure (owner must still approve). */
export function canRequestPatientErasure(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "assistant" ||
    role === "reception"
  );
}

/** Patient JSON export — clinical staff with patient access. */
export function canExportPatientData(role: AppRole): boolean {
  return canRequestPatientErasure(role);
}

/** Clinic ZIP backup — owner only (PRD §8.3 / D45). */
export function canExportClinicBackup(role: AppRole): boolean {
  return role === "owner";
}
