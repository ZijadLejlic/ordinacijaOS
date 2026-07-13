import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 — Email šabloni: owner edit; reception read/send. */

export function canReadEmailTemplates(role: AppRole): boolean {
  return role === "owner" || role === "reception";
}

export function canWriteEmailTemplates(role: AppRole): boolean {
  return role === "owner";
}

export function canSendEmailReminders(role: AppRole): boolean {
  return role === "owner" || role === "reception";
}
