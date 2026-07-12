import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getOperatorIdFromCookie } from "@/lib/operators/session";

type Client = SupabaseClient<Database>;

/**
 * Insert audit event with actor + optional active PIN operator (D10 / D33).
 * Payload must not include patient names for analytics-facing events.
 */
export async function writeAuditEvent(
  supabase: Client,
  opts: {
    clinicId: string;
    actorUserId: string;
    eventName: string;
    payload?: Json;
    operatorId?: string | null;
  },
) {
  const operatorId =
    opts.operatorId === undefined
      ? await getOperatorIdFromCookie()
      : opts.operatorId;

  const { error } = await supabase.from("audit_events").insert({
    clinic_id: opts.clinicId,
    actor_user_id: opts.actorUserId,
    operator_id: operatorId,
    event_name: opts.eventName,
    payload_json: opts.payload ?? {},
  });

  return { error };
}
