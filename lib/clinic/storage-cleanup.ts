import type { SupabaseClient } from "@supabase/supabase-js";
import { CLINIC_BRANDING_BUCKET } from "../branding/storage";
import { PATIENT_FILES_BUCKET } from "../patients/storage";
import type { Database } from "../supabase/database.types";

type ServiceClient = SupabaseClient<Database>;

const STORAGE_BUCKETS = [PATIENT_FILES_BUCKET, CLINIC_BRANDING_BUCKET] as const;
const LIST_PAGE_SIZE = 1000;
const REMOVE_CHUNK_SIZE = 100;

/**
 * Recursively list object paths under `prefix/` in a private bucket.
 * Storage.list is one level deep — walk folders for patient-files trees.
 */
async function listObjectPaths(
  service: ServiceClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await service.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw error;
    }

    const entries = data ?? [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have null id; files have a storage object id.
      if (entry.id === null) {
        paths.push(...(await listObjectPaths(service, bucket, path)));
      } else {
        paths.push(path);
      }
    }

    if (entries.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  return paths;
}

async function removePaths(
  service: ServiceClient,
  bucket: string,
  paths: string[],
): Promise<number> {
  if (paths.length === 0) return 0;

  let removed = 0;
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK_SIZE) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK_SIZE);
    const { error } = await service.storage.from(bucket).remove(chunk);
    if (error) {
      throw error;
    }
    removed += chunk.length;
  }
  return removed;
}

/**
 * Delete all Storage objects for a clinic via the Storage API (D21 / D45).
 * Must run before `hard_delete_clinic` — direct SQL DELETE on storage.objects
 * is blocked by Supabase (`protect_objects_delete`).
 */
export async function deleteClinicStorageObjects(
  service: ServiceClient,
  clinicId: string,
): Promise<number> {
  let total = 0;

  for (const bucket of STORAGE_BUCKETS) {
    const paths = await listObjectPaths(service, bucket, clinicId);
    total += await removePaths(service, bucket, paths);
  }

  return total;
}
