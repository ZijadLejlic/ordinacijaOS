import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** PRD §3.2 — Kalendar: owner/assistant/reception all; doctor own. */

export function canAccessCalendar(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "assistant" ||
    role === "reception"
  );
}

export function canWriteCalendar(role: AppRole): boolean {
  return canAccessCalendar(role);
}

/** Owner / assistant / reception manage all doctors; doctor only self. */
export function canManageAllDoctors(role: AppRole): boolean {
  return (
    role === "owner" || role === "assistant" || role === "reception"
  );
}

/** PRD §3.2 — CRM / waitlist: owner + reception. */
export function canAccessWaitlist(role: AppRole): boolean {
  return role === "owner" || role === "reception";
}

export function canWriteWaitlist(role: AppRole): boolean {
  return canAccessWaitlist(role);
}
