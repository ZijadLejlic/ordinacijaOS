import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";

export type LifecycleJobResult = {
  markedReadonly: string[];
  markedPendingDelete: string[];
  deleted: Array<{ clinicId: string; ok: boolean; error?: string }>;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Service-role lifecycle job (D6 / D45):
 * 1) trial/unpaid → readonly (7d grace)
 * 2) grace expired → pending_delete
 * 3) hard delete pending_delete clinics (+ storage + auth users)
 */
export async function runClinicLifecycleJob(): Promise<LifecycleJobResult> {
  const service = createServiceClient();

  const { data: transitions, error: transitionError } = await service.rpc(
    "run_clinic_lifecycle_transitions",
  );

  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const transitionPayload =
    transitions && typeof transitions === "object" && !Array.isArray(transitions)
      ? (transitions as Record<string, Json | undefined>)
      : {};

  const markedReadonly = asStringArray(transitionPayload.marked_readonly);
  const markedPendingDelete = asStringArray(
    transitionPayload.marked_pending_delete,
  );

  const { data: pending } = await service
    .from("clinics")
    .select("id")
    .eq("status", "pending_delete")
    .limit(50);

  const deleted: LifecycleJobResult["deleted"] = [];

  for (const row of pending ?? []) {
    const { data, error } = await service.rpc("hard_delete_clinic", {
      p_clinic_id: row.id,
    });

    if (error) {
      deleted.push({ clinicId: row.id, ok: false, error: error.message });
      continue;
    }

    deleted.push({
      clinicId: row.id,
      ok: true,
      error:
        data && typeof data === "object" && !Array.isArray(data)
          ? undefined
          : undefined,
    });
  }

  return {
    markedReadonly,
    markedPendingDelete,
    deleted,
  };
}
