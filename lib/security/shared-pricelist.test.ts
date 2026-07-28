import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createServiceRow,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P6b — PLAN-INT-020 (D16): shared pricelist toggle on clears
 * `services.location_id`.
 *
 * **Mechanism (read, not invented):**
 * `updateSharedPricelistAction` (`lib/locations/actions.ts`) — owner via
 * `requireLocationManager` / `canManageLocations` → patch
 * `clinics.settings_json.shared_pricelist_across_locations`. When enabling
 * shared mode (`FormData` checkbox `"on"`), also
 * `UPDATE services SET location_id = null WHERE clinic_id = … AND
 * location_id IS NOT NULL`. Toggle off only updates settings (no bind
 * restore). Migration note: `20260713260000_phase2f_locations.sql`.
 * Write-block half already probed by `LIFE-RLS-001` /
 * `clinic-write-block-sa.test.ts` (settingsSaved only — no clear assert).
 *
 * Pattern: P1.6 SA (`vi.mock` Next + real action + `createClinicWithRoles`).
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

import { updateSharedPricelistAction } from "@/lib/locations/actions";

describeSecurity("shared pricelist clears location_id (PLAN-INT-020 / D16)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let owner: TestUser;
  let ownerClient: DbClient;
  let locationId: string;
  let serviceId: string;
  let unboundServiceId: string;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `PLAN-INT-020 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "plan-int-020",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    created.push(...clinic.users);

    ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    activeActionClient = ownerClient;

    // Start in per-location mode so toggle-on is a real transition.
    const { data: clinicRow, error: clinicReadErr } = await service
      .from("clinics")
      .select("settings_json")
      .eq("id", clinicId)
      .single();
    if (clinicReadErr || !clinicRow) {
      throw new Error(clinicReadErr?.message ?? "clinic read failed");
    }
    const settings = (clinicRow.settings_json ?? {}) as Record<string, unknown>;
    const { error: settingsErr } = await service
      .from("clinics")
      .update({
        settings_json: {
          ...settings,
          shared_pricelist_across_locations: false,
        },
      })
      .eq("id", clinicId);
    if (settingsErr) {
      throw new Error(settingsErr.message);
    }

    const { data: location, error: locErr } = await service
      .from("clinic_locations")
      .insert({
        clinic_id: clinicId,
        name: `Lokacija ${randomTag().slice(-6)}`,
        address: "Test adresa 1",
      })
      .select("id")
      .single();
    if (locErr || !location) {
      throw new Error(locErr?.message ?? "location insert failed");
    }
    locationId = location.id;

    const bound = await createServiceRow(service, clinicId);
    serviceId = bound.id;
    const { error: bindErr } = await service
      .from("services")
      .update({ location_id: locationId })
      .eq("id", serviceId)
      .eq("clinic_id", clinicId);
    if (bindErr) throw new Error(bindErr.message);

    const unbound = await createServiceRow(service, clinicId);
    unboundServiceId = unbound.id;
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  });

  it("PLAN-INT-020: toggle shared on → settings true + services.location_id cleared", async () => {
    const { data: before } = await service
      .from("services")
      .select("id, location_id")
      .eq("clinic_id", clinicId)
      .in("id", [serviceId, unboundServiceId]);
    const beforeById = Object.fromEntries(
      (before ?? []).map((r) => [r.id, r.location_id]),
    );
    expect(beforeById[serviceId]).toBe(locationId);
    expect(beforeById[unboundServiceId]).toBeNull();

    activeActionClient = ownerClient;
    const fd = new FormData();
    fd.set("sharedPricelistAcrossLocations", "on");
    const result = await updateSharedPricelistAction(null, fd);
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("settingsSaved");

    const { data: clinicAfter, error: clinicErr } = await service
      .from("clinics")
      .select("settings_json")
      .eq("id", clinicId)
      .single();
    expect(clinicErr).toBeNull();
    const afterSettings = (clinicAfter?.settings_json ?? {}) as Record<
      string,
      unknown
    >;
    expect(afterSettings.shared_pricelist_across_locations).toBe(true);

    const { data: after, error: svcErr } = await service
      .from("services")
      .select("id, location_id")
      .eq("clinic_id", clinicId)
      .in("id", [serviceId, unboundServiceId]);
    expect(svcErr).toBeNull();
    const afterById = Object.fromEntries(
      (after ?? []).map((r) => [r.id, r.location_id]),
    );
    expect(afterById[serviceId]).toBeNull();
    expect(afterById[unboundServiceId]).toBeNull();
  });
});
