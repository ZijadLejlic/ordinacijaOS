import { createClient } from "@/lib/supabase/server";
import { isLowStock } from "@/lib/inventory/stock";

/** Active items at or below low-stock threshold (for nav badge). */
export async function countLowStockItems(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, quantity, low_stock_threshold")
    .eq("clinic_id", clinicId)
    .eq("is_active", true);

  if (error || !data) return 0;

  return data.filter((row) =>
    isLowStock(Number(row.quantity), Number(row.low_stock_threshold)),
  ).length;
}
