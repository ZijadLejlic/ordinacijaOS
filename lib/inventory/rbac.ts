import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Clinical staff — PRD §6.12 inventar (no accountant/technician). */
export function canAccessInventory(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "assistant" ||
    role === "reception"
  );
}

export function canWriteInventory(role: AppRole): boolean {
  return canAccessInventory(role);
}
