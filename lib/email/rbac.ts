import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * PRD §3.2 / D52 — Email settings UI (šabloni): owner edit; reception
 * read + test send. Doctor does **not** access `/settings/email`.
 */
export function canReadEmailTemplates(role: AppRole): boolean {
  return role === "owner" || role === "reception";
}

export function canWriteEmailTemplates(role: AppRole): boolean {
  return role === "owner";
}

/**
 * D52 — Calendar appointment reminder send: owner, reception, and doctor
 * (doctor scoped to own appointments in `sendAppointmentReminderAction`).
 * CRM outbound stays reception/owner (`canSendCrmMessages`).
 */
export function canSendEmailReminders(role: AppRole): boolean {
  return (
    role === "owner" || role === "reception" || role === "doctor"
  );
}
