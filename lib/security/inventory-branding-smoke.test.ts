import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { parseBrandingJson } from "@/lib/branding/parse";

/**
 * P4.8 (docs/QA/Implementation-Plan.md): inventory + branding smoke INT.
 * Closes `PLAN-INT-021`, `PLAN-INT-022` / §6.12 / §6.13 / §12.1 branding.
 *
 * **Mechanism (grepped, not assumed):**
 * - Low-stock: `isLowStock(qty, threshold)` = `qty <= threshold`
 *   (`lib/inventory/stock.ts`). Nav badge = `countLowStockItems`
 *   (`lib/inventory/load.ts`) — active rows only. List flag uses same
 *   helper in inventory page / forms. Create/adjust via SA
 *   (`createInventoryItemAction` / `adjustInventoryQtyAction`) +
 *   `assertFeature(inventory_basic)`. Feature deny = `PLAN-SEC-001` /
 *   `PLAN-INT-011`. RBAC = `RBAC-INT-021`.
 * - Branding colors: `updateBrandingColorsAction` → owner +
 *   `branding_custom` → merge into `clinics.branding_json` via
 *   `brandingToJson` + audit `clinic.branding_colors_updated` (booleans
 *   only, no hex in payload). Parse unit = `PLAN-UNIT-010`. Logo ACL
 *   (`FILE-INT-011`) / upload path COVERED in `branding-upload-acl.test.ts`.
 *
 * Pattern: P1.6 SA (`vi.mock` Next + real actions + `createClinicWithRoles`).
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

import {
  adjustInventoryQtyAction,
  createInventoryItemAction,
  setInventoryItemActiveAction,
} from "@/lib/inventory/actions";
import { countLowStockItems } from "@/lib/inventory/load";
import { updateBrandingColorsAction } from "@/lib/branding/actions";

function inventoryForm(opts: {
  name: string;
  quantity: number;
  lowStockThreshold: number;
}): FormData {
  const fd = new FormData();
  fd.set("name", opts.name);
  fd.set("unit", "kom");
  fd.set("quantity", String(opts.quantity));
  fd.set("lowStockThreshold", String(opts.lowStockThreshold));
  fd.set("notes", "");
  return fd;
}

describeSecurity("P4.8 inventory + branding smoke (PLAN-INT-021/022)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let owner: TestUser;
  let ownerClient: DbClient;
  let tag: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);
    tag = randomTag().slice(-6);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `PLAN-INT-021 BrandInv ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "plan-int-021",
    });
    clinicId = clinic.clinicId;
    created.push(...clinic.users);
    owner = clinic.byRole.owner!;
    ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
  }, 120_000);

  afterAll(async () => {
    if (service && created.length > 0) {
      await cleanupClinics(service, created);
    }
  }, 120_000);

  it("PLAN-INT-021: qty≤threshold → countLowStockItems / inactive excluded", async () => {
    activeActionClient = ownerClient;

    const lowName = `LowStock${tag}`;
    const okName = `OkStock${tag}`;
    const edgeName = `EdgeStock${tag}`;

    const low = await createInventoryItemAction(
      null,
      inventoryForm({ name: lowName, quantity: 2, lowStockThreshold: 5 }),
    );
    expect(low?.message).toBe("created");

    const ok = await createInventoryItemAction(
      null,
      inventoryForm({ name: okName, quantity: 20, lowStockThreshold: 5 }),
    );
    expect(ok?.message).toBe("created");

    const edge = await createInventoryItemAction(
      null,
      inventoryForm({ name: edgeName, quantity: 5, lowStockThreshold: 5 }),
    );
    expect(edge?.message).toBe("created");

    // Badge helper (same isLowStock as list flag).
    expect(await countLowStockItems(clinicId)).toBe(2); // low + edge

    const { data: items } = await service
      .from("inventory_items")
      .select("id, name, quantity, low_stock_threshold, is_active")
      .eq("clinic_id", clinicId)
      .in("name", [lowName, okName, edgeName]);
    expect(items).toHaveLength(3);

    const lowRow = items!.find((r) => r.name === lowName)!;
    const okRow = items!.find((r) => r.name === okName)!;

    // Raise low above threshold → badge drops by 1.
    const adjusted = await adjustInventoryQtyAction(lowRow.id, 10);
    expect(adjusted?.message).toBe("adjusted");
    expect(await countLowStockItems(clinicId)).toBe(1); // edge only

    const { data: afterAdj } = await service
      .from("inventory_items")
      .select("quantity")
      .eq("id", lowRow.id)
      .single();
    expect(Number(afterAdj?.quantity)).toBe(12);

    // Deactivate remaining low (edge) → excluded from badge.
    const edgeRow = items!.find((r) => r.name === edgeName)!;
    const deactivated = await setInventoryItemActiveAction(edgeRow.id, false);
    expect(deactivated?.message).toBe("deactivated");
    expect(await countLowStockItems(clinicId)).toBe(0);

    // Sanity: ok never flagged.
    expect(Number(okRow.quantity)).toBeGreaterThan(
      Number(okRow.low_stock_threshold),
    );
  }, 60_000);

  it("PLAN-INT-022: owner sets colors → branding_json persisted + audit", async () => {
    activeActionClient = ownerClient;

    const colors = {
      background: "#1A2B3C",
      text: "#F5F5F5",
      accent: "#C45C26",
    };

    const fd = new FormData();
    fd.set("background", colors.background);
    fd.set("text", colors.text);
    fd.set("accent", colors.accent);

    const saved = await updateBrandingColorsAction(null, fd);
    expect(saved?.message).toBe("colorsSaved");

    const { data: clinic } = await service
      .from("clinics")
      .select("branding_json")
      .eq("id", clinicId)
      .single();

    const branding = parseBrandingJson(clinic?.branding_json);
    expect(branding.colors).toEqual(colors);

    const { data: audits } = await service
      .from("audit_events")
      .select("event_name, payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "clinic.branding_colors_updated")
      .order("created_at", { ascending: false })
      .limit(1);

    expect(audits).toHaveLength(1);
    expect(audits?.[0]?.payload_json).toEqual({
      has_background: true,
      has_text: true,
      has_accent: true,
    });
  }, 60_000);
});
