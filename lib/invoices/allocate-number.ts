import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type InvoiceSeries = {
  series_year: number;
  series_number: number;
};

/**
 * Allocate the next invoice serial via SECURITY DEFINER RPC
 * (`allocate_invoice_number` — JWT clinic gate, RBAC, MFA, row lock).
 *
 * Caller must already enforce invoice write RBAC + feature gate.
 */
export async function allocateInvoiceNumber(
  userClient: Client,
  clinicId: string,
): Promise<InvoiceSeries | { error: string }> {
  const { data, error } = await userClient.rpc("allocate_invoice_number", {
    p_clinic_id: clinicId,
  });

  if (!error && data?.[0]) {
    return {
      series_year: data[0].series_year,
      series_number: data[0].series_number,
    };
  }

  return { error: "createFailed" };
}
