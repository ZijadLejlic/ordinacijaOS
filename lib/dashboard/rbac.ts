import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * PRD §3.2 Dashboard KPI:
 * owner=full, doctor=limited, reception=limited, accountant=financial, assistant=none.
 */
export function canSeeDashboardKpis(role: AppRole): boolean {
  return (
    role === "owner" ||
    role === "doctor" ||
    role === "reception" ||
    role === "accountant"
  );
}

export function canSeeOperationalKpis(role: AppRole): boolean {
  return role === "owner" || role === "doctor" || role === "reception";
}

export function canSeeFinancialKpis(role: AppRole): boolean {
  return role === "owner" || role === "accountant";
}
