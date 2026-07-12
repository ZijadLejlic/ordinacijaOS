import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { OPERATOR_COOKIE } from "@/lib/operators/constants";

type Client = SupabaseClient<Database>;

export type PinGate = "ok" | "switch";

/**
 * D10: Shared reception/assistant must pick an active operator via PIN
 * when at least one operator exists for their profile.
 */
export async function resolvePinGate(
  supabase: Client,
  operatorCookie: string | undefined,
): Promise<PinGate> {
  const { data: needsPin, error } = await supabase.rpc("shared_desk_needs_pin");
  if (error || !needsPin) {
    return "ok";
  }

  if (!operatorCookie || !/^[0-9a-f-]{36}$/i.test(operatorCookie)) {
    return "switch";
  }

  const { data: belongs, error: belongError } = await supabase.rpc(
    "operator_belongs_to_me",
    { p_operator_id: operatorCookie },
  );

  if (belongError || !belongs) {
    return "switch";
  }

  return "ok";
}

export function readOperatorCookieFromRequest(cookieHeader: string | null) {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OPERATOR_COOKIE}=`));
  return match?.slice(OPERATOR_COOKIE.length + 1);
}
