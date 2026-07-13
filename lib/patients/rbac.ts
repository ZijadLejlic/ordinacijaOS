import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 access matrix — mirrors DB RLS helpers (`can_access_patients` etc.). */

export function canAccessPatients(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "assistant" ||
    role === "reception"
  );
}

export function canWritePatients(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "assistant" ||
    role === "reception"
  );
}

export function canAccessOdontogram(role: AppRole): boolean {
  return role === "owner" || role === "doctor" || role === "assistant";
}

export function canWriteOdontogram(role: AppRole): boolean {
  return role === "owner" || role === "doctor";
}

/** PRD §3.2 — same matrix row as odontogram / plan terapije. */
export function canAccessTreatmentPlan(role: AppRole): boolean {
  return canAccessOdontogram(role);
}

export function canWriteTreatmentPlan(role: AppRole): boolean {
  return canWriteOdontogram(role);
}

export function canWriteServices(role: AppRole): boolean {
  return role === "owner";
}

const ALL_ROLES = [
  "owner",
  "doctor",
  "assistant",
  "reception",
  "accountant",
  "technician",
] as const satisfies readonly AppRole[];

export function canReadServices(role: AppRole): boolean {
  return ALL_ROLES.includes(role);
}
