import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P6b — FILE-INT-001 (D21/D22): non-image upload presented as image →
 * rejected (not stored as patient image).
 *
 * **Mechanism (read, not invented):**
 * `uploadImageAction` (`lib/patients/actions.ts`):
 *   1. MIME/extension allowlist (`isAllowedPatientImageFile`) else `imageMustBeImage`
 *   2. `convertImageToWebp` via sharp (`lib/patients/storage.ts`) — corrupt /
 *      non-raster bytes → catch → `imageConvertFailed`
 *   No path stores raw exe bytes; conversion is mandatory before storage.
 *
 * Pattern: P1.6 SA (same harness as `image-limit-db.test.ts`).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeActionClient,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "bs",
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: () => {
    throw new Error("unexpected redirect in FILE-INT-001");
  },
  getPathname: () => "/",
  Link: () => null,
  usePathname: () => "/",
  useRouter: () => ({ push: () => undefined }),
}));

import { uploadImageAction } from "@/lib/patients/actions";

/** MZ header — looks like a Windows PE, not a raster. */
const EXE_BYTES = new Uint8Array([
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
  0xff, 0xff, 0x00, 0x00, 0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describeSecurity("non-image upload as image rejected (FILE-INT-001)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let doctor: TestUser;
  let doctorClient: DbClient;
  let patientId: string;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["doctor"],
      clinicName: `FILE-INT-001 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "file-int-001",
    });
    doctor = clinic.byRole.doctor!;
    created.push(...clinic.users);

    doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
    activeActionClient = doctorClient;

    const patient = await createPatient(service, clinic.clinicId);
    patientId = patient.id;
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  });

  it("FILE-INT-001: exe MIME → imageMustBeImage (no row)", async () => {
    activeActionClient = doctorClient;
    const fd = new FormData();
    fd.set("title", "malware");
    fd.set(
      "file",
      new File([EXE_BYTES], "payload.exe", {
        type: "application/octet-stream",
      }),
    );
    const result = await uploadImageAction(patientId, null, fd);
    expect(result?.error).toBe("imageMustBeImage");

    const { count } = await service
      .from("patient_images")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId);
    expect(count ?? 0).toBe(0);
  });

  it("FILE-INT-001: exe bytes labeled image/png → imageConvertFailed (no row)", async () => {
    activeActionClient = doctorClient;
    const fd = new FormData();
    fd.set("title", "spoofed");
    fd.set(
      "file",
      new File([EXE_BYTES], "spoof.png", { type: "image/png" }),
    );
    const result = await uploadImageAction(patientId, null, fd);
    expect(result?.error).toBe("imageConvertFailed");

    const { count } = await service
      .from("patient_images")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId);
    expect(count ?? 0).toBe(0);
  });
});
