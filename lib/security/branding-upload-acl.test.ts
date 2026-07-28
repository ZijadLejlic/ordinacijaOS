import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";
import {
  CLINIC_BRANDING_BUCKET,
  logoPath,
} from "@/lib/branding/storage";

/**
 * P6b — FILE-INT-011 (§6.13 / T-FILE-06): branding logo upload ACL —
 * doctor denied; owner allowed.
 *
 * **Mechanism (read, not invented):**
 * - SA: `uploadBrandingLogoAction` → `requireBrandingManager` →
 *   `canManageBranding` = owner only (`lib/branding/rbac.ts`) →
 *   `assertFeature(branding_custom)` → sharp WebP → storage upsert
 *   `{clinic_id}/logo.webp` → `branding_json.logo_path`.
 * - Storage RLS (`20260713270000_phase2g_branding.sql`): INSERT/UPDATE/DELETE
 *   on `clinic-branding` require `is_clinic_owner()` (same clinic folder).
 * - Colors RBAC already `RBAC-INT-014`; cross-clinic branding =
 *   `FILE-RLS-002`. This ID closes the logo upload half.
 *
 * Pattern: P1.6 SA + P1.2 storage (`vi.mock` Next + real action).
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

import { uploadBrandingLogoAction } from "@/lib/branding/actions";

async function pngFile(name: string): Promise<File> {
  const buffer = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 20, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
  return new File([buffer], name, { type: "image/png" });
}

describeSecurity("branding logo upload ACL (FILE-INT-011)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let owner: TestUser;
  let doctor: TestUser;
  let ownerClient: DbClient;
  let doctorClient: DbClient;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor"],
      clinicName: `FILE-INT-011 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "file-int-011",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    doctor = clinic.byRole.doctor!;
    created.push(...clinic.users);

    ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    doctorClient = await signInAs(url, anonKey, doctor.email, doctor.password);
  }, 120_000);

  afterAll(async () => {
    await service.storage
      .from(CLINIC_BRANDING_BUCKET)
      .remove([logoPath(clinicId)])
      .catch(() => undefined);
    await cleanupClinics(service, created);
  });

  it("FILE-INT-011: doctor uploadBrandingLogoAction → forbidden", async () => {
    activeActionClient = doctorClient;
    const fd = new FormData();
    fd.set("logo", await pngFile("doctor-logo.png"));
    const result = await uploadBrandingLogoAction(null, fd);
    expect(result?.error).toBe("forbidden");
    expect(result?.message).toBeUndefined();

    const { data: listed } = await service.storage
      .from(CLINIC_BRANDING_BUCKET)
      .list(clinicId, { limit: 10 });
    expect(listed ?? []).toHaveLength(0);
  });

  it("FILE-INT-011: doctor direct storage upload to clinic-branding denied", async () => {
    const path = logoPath(clinicId);
    const bytes = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .webp()
      .toBuffer();

    const { error } = await doctorClient.storage
      .from(CLINIC_BRANDING_BUCKET)
      .upload(path, bytes, { contentType: "image/webp", upsert: true });
    expect(error).not.toBeNull();

    const { data: listed } = await service.storage
      .from(CLINIC_BRANDING_BUCKET)
      .list(clinicId, { limit: 10 });
    expect(listed ?? []).toHaveLength(0);
  });

  it("FILE-INT-011: owner uploadBrandingLogoAction → logoUploaded + object", async () => {
    activeActionClient = ownerClient;
    const fd = new FormData();
    fd.set("logo", await pngFile("owner-logo.png"));
    const result = await uploadBrandingLogoAction(null, fd);
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("logoUploaded");

    const { data: clinicRow } = await service
      .from("clinics")
      .select("branding_json")
      .eq("id", clinicId)
      .single();
    const branding = (clinicRow?.branding_json ?? {}) as Record<string, unknown>;
    expect(branding.logo_path).toBe(logoPath(clinicId));

    const { data: blob, error } = await service.storage
      .from(CLINIC_BRANDING_BUCKET)
      .download(logoPath(clinicId));
    expect(error).toBeNull();
    expect(blob).not.toBeNull();
    expect((await blob!.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
