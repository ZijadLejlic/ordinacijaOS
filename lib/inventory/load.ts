import { createClient } from "@/lib/supabase/server";

/** Active items at or below low-stock threshold (for nav badge). */
export async function countLowStockItems(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_low_stock_items", {
    p_clinic_id: clinicId,
  });

  if (error || data == null) return 0;
  return Number(data) || 0;
}
