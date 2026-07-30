import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteClinicStorageObjects } from "./storage-cleanup";
import type { Database } from "../supabase/database.types";

type ServiceClient = SupabaseClient<Database>;

export type HardDeleteClinicResult = {
  ok: boolean;
  clinicId: string;
  storageObjectsDeleted: number;
  error?: string;
};

/**
 * D45 hard delete: Storage API cleanup first, then DB RPC (clinic cascade +
 * auth users). Never DELETE storage.objects via SQL.
 */
export async function hardDeleteClinic(
  service: ServiceClient,
  clinicId: string,
): Promise<HardDeleteClinicResult> {
  let storageObjectsDeleted = 0;

  try {
    storageObjectsDeleted = await deleteClinicStorageObjects(service, clinicId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "storage_cleanup_failed";
    return {
      ok: false,
      clinicId,
      storageObjectsDeleted,
      error: message,
    };
  }

  const { error } = await service.rpc("hard_delete_clinic", {
    p_clinic_id: clinicId,
  });

  if (error) {
    return {
      ok: false,
      clinicId,
      storageObjectsDeleted,
      error: error.message,
    };
  }

  return { ok: true, clinicId, storageObjectsDeleted };
}
