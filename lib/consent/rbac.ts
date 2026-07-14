import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

const READ_ROLES: AppRole[] = ["owner", "doctor", "assistant", "reception"];
const WRITE_ROLES: AppRole[] = ["owner"];
const SIGN_ROLES: AppRole[] = ["owner", "doctor", "assistant", "reception"];

export function canReadConsentForms(role: AppRole) {
  return READ_ROLES.includes(role);
}

export function canWriteConsentForms(role: AppRole) {
  return WRITE_ROLES.includes(role);
}

export function canSignConsents(role: AppRole) {
  return SIGN_ROLES.includes(role);
}
