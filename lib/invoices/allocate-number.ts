import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";
import { formatInTimeZone } from "date-fns-tz";

type Client = SupabaseClient<Database>;

export type InvoiceSeries = {
  series_year: number;
  series_number: number;
};

function currentSeriesYear(now = new Date()): number {
  return Number(formatInTimeZone(now, CLINIC_TIMEZONE, "yyyy"));
}

/**
 * Preferred path: SECURITY DEFINER RPC (row lock).
 * Fallback: service-role optimistic upsert — used while
 * `allocate_invoice_number` hits Postgres 42702 (ambiguous series_year)
 * until migration `20260714040000_fix_allocate_invoice_number` is applied.
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

  const ambiguous =
    error?.code === "42702" ||
    (error?.message ?? "").toLowerCase().includes("ambiguous");

  if (!ambiguous) {
    return { error: "createFailed" };
  }

  return allocateInvoiceNumberFallback(clinicId);
}

async function allocateInvoiceNumberFallback(
  clinicId: string,
): Promise<InvoiceSeries | { error: string }> {
  const service = createServiceClient();
  const year = currentSeriesYear();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: existing } = await service
      .from("invoice_number_counters")
      .select("last_number")
      .eq("clinic_id", clinicId)
      .eq("series_year", year)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await service
        .from("invoice_number_counters")
        .insert({
          clinic_id: clinicId,
          series_year: year,
          last_number: 1,
        });

      if (!insertError) {
        return { series_year: year, series_number: 1 };
      }

      // Concurrent insert — retry read/update
      continue;
    }

    const next = existing.last_number + 1;
    const { data: updated, error: updateError } = await service
      .from("invoice_number_counters")
      .update({ last_number: next })
      .eq("clinic_id", clinicId)
      .eq("series_year", year)
      .eq("last_number", existing.last_number)
      .select("last_number")
      .maybeSingle();

    if (!updateError && updated) {
      return { series_year: year, series_number: next };
    }
  }

  return { error: "createFailed" };
}
