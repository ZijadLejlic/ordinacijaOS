import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
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
 * P1.6 + P1.11 (docs/QA/Implementation-Plan.md): image/RTG plan limit (D22)
 * at the DB layer. Closes `FILE-DB-001`; Discrepancies.md `D-02` RESOLVED.
 *
 * **Mechanism (P1.11 hard DB gate — was app-only residual in P1.6):**
 * `lib/entitlements/limits.ts` `assertCanAddPatientImage` still gates the
 * Server Action path. In addition, `public.enforce_patient_image_limits()`
 * (`20260728000000_plan_limit_patient_images.sql`) is a `before insert`
 * trigger on `patient_images` that counts rows per `patient_id` against
 * `plans.limits_json.images_per_patient` and raises `plan_limit_images`
 * (`check_violation`) — same pattern as `plan_limit_users` /
 * `plan_limit_doctors` / `plan_limit_locations`.
 *
 * **Three tests:**
 *   1. Direct authenticated INSERT past the plan cap is denied by the DB
 *      trigger (`plan_limit_images`); count stays at the cap.
 *   2. Real `uploadImageAction` rejects at-cap upload with `imageLimit`
 *      (SA-level defense still live; defense-in-depth with the trigger).
 *   3. Positive control: same action succeeds under the cap.
 *
 * Plan limit value (`images_per_patient`) is read from the real `plans`
 * table at run time, not hardcoded.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const PATIENT_FILES_BUCKET = "patient-files";

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

// `uploadImageAction` never calls `redirect()` on any path this file
// exercises — this import only exists because `lib/patients/actions.ts` has
// one top-level `import { redirect } from "@/i18n/navigation"` shared by
// other exports. Bare-import resolving `@/i18n/navigation` fails under
// Vitest's ESM resolution in this Next.js version, so it is mocked out.
vi.mock("@/i18n/navigation", () => ({
  redirect: () => {
    throw new Error("uploadImageAction unexpectedly called redirect()");
  },
}));

// Textually after the mocks above on purpose (Vitest hoists `vi.mock`).
import { uploadImageAction } from "@/lib/patients/actions";

async function pngFile(name: string): Promise<File> {
  const buffer = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 180, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
  return new File([buffer], name, { type: "image/png" });
}

async function countPatientImages(
  service: DbClient,
  patientId: string,
): Promise<number> {
  const { count, error } = await service
    .from("patient_images")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

describeSecurity("image limit DB hard gate + SA-level block (D22 / D-02)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let doctor: TestUser;
  let doctorClient: DbClient;
  let imagesPerPatientLimit: number;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["doctor"],
      clinicName: `Image Limit ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "file-db",
    });
    clinicId = clinic.clinicId;
    doctor = clinic.byRole.doctor!;
    created.push(...clinic.users);

    doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);

    const { data: plan, error: planError } = await service
      .from("plans")
      .select("limits_json")
      .eq("code", "starter")
      .single();
    if (planError || !plan) {
      throw new Error(planError?.message ?? "starter plan not found");
    }
    const limitsJson = plan.limits_json;
    const parsedLimit =
      limitsJson &&
      typeof limitsJson === "object" &&
      !Array.isArray(limitsJson) &&
      typeof limitsJson.images_per_patient === "number"
        ? limitsJson.images_per_patient
        : null;
    if (parsedLimit === null) {
      throw new Error(
        "starter plan has no numeric images_per_patient limit — test cannot proceed without a real cap",
      );
    }
    imagesPerPatientLimit = parsedLimit;
  }, 60_000);

  afterAll(async () => {
    // cleanupClinics → Storage API + hard_delete_clinic (clinic cascade).
    await cleanupClinics(service, created);
  }, 60_000);

  it("FILE-DB-001: direct authenticated INSERT past the plan cap is denied by DB trigger (plan_limit_images)", async () => {
    const patient = await createPatient(service, clinicId, {
      firstName: "Bypass",
      lastName: `Patient${randomTag().slice(-6)}`,
    });

    for (let i = 0; i < imagesPerPatientLimit; i += 1) {
      const { error } = await doctorClient
        .from("patient_images")
        .insert({
          clinic_id: clinicId,
          patient_id: patient.id,
          title: `Direktan insert ${i}`,
          storage_path: `${clinicId}/${patient.id}/images/${randomTag()}-${i}.webp`,
          mime_type: "image/webp",
          size_bytes: 10,
          uploaded_by: doctor.userId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
    }

    const { error: overLimitError } = await doctorClient
      .from("patient_images")
      .insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        title: "Preko limita",
        storage_path: `${clinicId}/${patient.id}/images/${randomTag()}-over.webp`,
        mime_type: "image/webp",
        size_bytes: 10,
        uploaded_by: doctor.userId,
      })
      .select("id")
      .single();

    expect(overLimitError).not.toBeNull();
    expect(overLimitError?.message.toLowerCase()).toContain("plan_limit_images");

    const finalCount = await countPatientImages(service, patient.id);
    expect(finalCount).toBe(imagesPerPatientLimit);
  });

  it("FILE-DB-001 / D-02: uploadImageAction blocks a real upload once the patient is at the plan cap (SA-level defense)", async () => {
    const patient = await createPatient(service, clinicId, {
      firstName: "AtCap",
      lastName: `Patient${randomTag().slice(-6)}`,
    });

    for (let i = 0; i < imagesPerPatientLimit; i += 1) {
      const { error } = await service.from("patient_images").insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        title: `Seed ${i}`,
        storage_path: `${clinicId}/${patient.id}/images/${randomTag()}-${i}.webp`,
        mime_type: "image/webp",
        size_bytes: 10,
        uploaded_by: doctor.userId,
      });
      expect(error).toBeNull();
    }

    activeActionClient = doctorClient;
    const formData = new FormData();
    formData.set("title", "Preko limita");
    formData.set("file", await pngFile("over-limit.png"));

    const result = await uploadImageAction(patient.id, null, formData);
    expect(result?.error).toBe("imageLimit");

    const finalCount = await countPatientImages(service, patient.id);
    expect(finalCount).toBe(imagesPerPatientLimit);

    const { data: listed } = await service.storage
      .from(PATIENT_FILES_BUCKET)
      .list(`${clinicId}/${patient.id}/images`, { limit: 100 });
    expect((listed ?? []).length).toBe(0);
  });

  it("uploadImageAction succeeds for a fresh patient under the cap (positive control — SA block is count-specific, not a broken feature/RBAC gate)", async () => {
    const patient = await createPatient(service, clinicId, {
      firstName: "UnderCap",
      lastName: `Patient${randomTag().slice(-6)}`,
    });

    activeActionClient = doctorClient;
    const formData = new FormData();
    formData.set("title", "Prva slika");
    formData.set("file", await pngFile("under-limit.png"));

    const result = await uploadImageAction(patient.id, null, formData);
    expect(result?.message).toBe("imageUploaded");

    const finalCount = await countPatientImages(service, patient.id);
    expect(finalCount).toBe(1);

    const { data: listed } = await service.storage
      .from(PATIENT_FILES_BUCKET)
      .list(`${clinicId}/${patient.id}/images`, { limit: 100 });
    expect((listed ?? []).length).toBe(1);
  });
});
