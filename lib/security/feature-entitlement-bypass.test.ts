import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  resolvePlanId,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P1.7 (docs/QA/Implementation-Plan.md): feature entitlement (D42) PostgREST
 * bypass probe. Closes `PLAN-SEC-001`; documents Discrepancies.md `D-03`.
 *
 * **Mechanism found (read before writing a single assertion, not assumed):**
 * `lib/entitlements/features.ts` `assertFeature(supabase, clinicId, feature)`
 * loads the clinic's plan entitlement matrix from `plan_entitlements` and
 * returns `{ ok: false, code: "featureDisabled" }` when the feature is off.
 * It is called from `lib/inventory/actions.ts`'s
 * `createInventoryItemAction`/`updateInventoryItemAction`/
 * `adjustInventoryQtyAction`/`setInventoryItemActiveAction` — always
 * **after** the RBAC (`requireInventoryWriter` → `canWriteInventory`) check
 * and **before** the `inventory_items` insert/update. Grepped every
 * migration for `has_feature`/`plan_entitlements`/`feature_key` referenced
 * from a *different* table's RLS policy: the only hits are
 * `plan_entitlements`'s own table DDL/index/RLS (a plain
 * `plans.is_active = true` select policy, nothing about *other* tables
 * checking it) — no RLS policy or trigger anywhere in the schema calls a
 * `clinic_has_feature()`-style function. Read `inventory_items`' full RLS in
 * `20260714060000_phase3e_inventory_basic.sql`: exactly `clinic_id =
 * current_clinic_id()` (tenant scope) + `can_write_inventory()` (RBAC:
 * owner/doctor/assistant/reception) + `owner_mfa_ok()` (RESTRICTIVE) +
 * `clinic_is_writable()` (RESTRICTIVE, readonly/pending_delete guard) — no
 * entitlement/plan check at all. This is exactly Discrepancies.md `D-03`
 * ("Feature entitlements (D42) enforced only in Server Actions, S0
 * residual") and exactly Test-Strategy.md's own literal `PLAN-SEC-001`
 * wording — "document fail/gap; prefer deny" — i.e. this row does **not**
 * require a hard DB deny to flip to COVERED, the same reasoning `FILE-DB-001`
 * (P1.6/D-02) already established for the sibling image-limit residual.
 *
 * Confirmed the "starter lacks `inventory_basic`" precondition against the
 * real `plan_entitlements` table via Supabase MCP `execute_sql` (read-only,
 * no writes): `starter -> enabled=false`, `professional`/`premium_ai`/
 * `enterprise -> enabled=true` — matches PRD §4.3 (inventory is Pro+).
 *
 * No existing UNIT/INT test exercises `assertFeature` itself (grepped
 * `assertFeature`/`PLAN-INT-011` across `lib/**`): `PLAN-UNIT-*` rows only
 * cover `parseLimitsJson`/`assertCanAddPatientImage` (pure, synchronous), and
 * `PLAN-INT-011` ("assertFeature bypassed in SA") is still `GAP` in
 * Test-Strategy.md §4.2 — this file's SA-level tests below also serve as the
 * first real coverage of that async, DB-backed function's actual behavior in
 * this suite, though `PLAN-INT-011`'s own catalog row is left `GAP` per the
 * task brief (P1.7's scope is `PLAN-SEC-001`, not a full RBAC×feature matrix
 * — leaving that ID for whoever picks up P3.5).
 *
 * **Three tests, matching the brief's (b) branch (residual confirmed, same
 * shape as P1.6):**
 *   1. A signed-in doctor (has `can_write_inventory()`) on a **starter**
 *      clinic (no `inventory_basic`) inserts directly into `inventory_items`
 *      via PostgREST, bypassing `createInventoryItemAction`/`assertFeature`
 *      entirely — the insert succeeds. This is the `PLAN-SEC-001` finding:
 *      DB/RLS does not enforce D42 entitlements.
 *   2. The *real* `createInventoryItemAction` (not a re-implementation) is
 *      called against that same starter clinic and is rejected with
 *      `featureDisabled`, with zero rows inserted. Its only Next.js-specific
 *      dependencies beyond `@/lib/supabase/server` are `next-intl/server`'s
 *      `getLocale()` and `next/cache`'s `revalidatePath()` (both no-ops on
 *      the failure path — `assertFeature` fails before either is reached)
 *      plus (success path only, test 3) `next/headers`'s `cookies()`
 *      transitively via `writeAuditEvent` → `getOperatorIdFromCookie`.
 *      Unlike `uploadImageAction` (P1.6), `lib/inventory/actions.ts` has no
 *      top-level `@/i18n/navigation` import at all (grepped — no `redirect`
 *      call anywhere in the file), so that extra mock isn't needed here.
 *   3. Positive control: the same real action succeeds for a **professional**
 *      clinic (has `inventory_basic`) with an otherwise-identical doctor
 *      user — proves the denial in test 2 is the entitlement gate
 *      specifically, not a broken RBAC check or some other unrelated
 *      failure that would reject every call regardless of plan.
 *
 * No RLS/migration change made here — per `multi-tenant-security.mdc` and
 * the explicit task brief, a real product fix (a `clinic_has_feature()`
 * WITH CHECK on `inventory_items` and other Pro+ tables) was considered in
 * P1.11 and **WAIVED for MVP** (Discrepancies D-03 Option B, 2026-07-28) —
 * wider blast radius than D-02's single image trigger; revisit post-MVP.
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

// Textually after the mocks above on purpose (Vitest hoists `vi.mock` calls
// above all imports regardless of source position — see
// image-limit-db.test.ts's identical note) — this imports the *real*
// `createInventoryItemAction`, not a re-implementation of its logic.
import { createInventoryItemAction } from "@/lib/inventory/actions";

function inventoryFormData(name: string): FormData {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("unit", "kom");
  formData.set("quantity", "10");
  formData.set("lowStockThreshold", "2");
  formData.set("notes", "");
  return formData;
}

async function countInventoryItems(
  service: DbClient,
  clinicId: string,
  namePrefix: string,
): Promise<number> {
  const { count, error } = await service
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .ilike("name", `${namePrefix}%`);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

describeSecurity(
  "feature entitlement (D42) DB bypass + SA-level block (PLAN-SEC-001, D-03 residual)",
  () => {
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;
    let starterClinicId: string;
    let starterDoctor: TestUser;
    let starterDoctorClient: DbClient;
    let professionalClinicId: string;
    let professionalDoctor: TestUser;
    let professionalDoctorClient: DbClient;

    const created: TestUser[] = [];

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      const starterPlanId = await resolvePlanId(service, "starter");
      const { data: starterEnt, error: starterEntError } = await service
        .from("plan_entitlements")
        .select("enabled")
        .eq("plan_id", starterPlanId)
        .eq("feature_key", "inventory_basic")
        .single();
      if (starterEntError || !starterEnt) {
        throw new Error(
          starterEntError?.message ??
            "starter plan_entitlements row for inventory_basic not found",
        );
      }
      if (starterEnt.enabled) {
        throw new Error(
          "starter plan unexpectedly has inventory_basic enabled — this test's premise (D42 gap on a Starter-excluded feature) no longer holds; re-check PRD §4.3 / seed.sql before proceeding",
        );
      }

      const starterClinic = await createClinicWithRoles(service, {
        roles: ["doctor"],
        clinicName: `Feature Bypass Starter ${randomTag()}`,
        planCode: "starter",
        emailPrefix: "plan-sec",
      });
      starterClinicId = starterClinic.clinicId;
      starterDoctor = starterClinic.byRole.doctor!;
      created.push(...starterClinic.users);
      starterDoctorClient = await signInAs(
        url,
        anonKey,
        starterDoctor.email,
        starterDoctor.password,
      );

      const professionalClinic = await createClinicWithRoles(service, {
        roles: ["doctor"],
        clinicName: `Feature Bypass Professional ${randomTag()}`,
        planCode: "professional",
        emailPrefix: "plan-sec",
      });
      professionalClinicId = professionalClinic.clinicId;
      professionalDoctor = professionalClinic.byRole.doctor!;
      created.push(...professionalClinic.users);
      professionalDoctorClient = await signInAs(
        url,
        anonKey,
        professionalDoctor.email,
        professionalDoctor.password,
      );
    }, 60_000);

    afterAll(async () => {
      await cleanupClinics(service, created);
    }, 60_000);

    it("PLAN-SEC-001: direct authenticated INSERT into inventory_items on a Starter clinic (no inventory_basic) is NOT blocked by RLS/DB (D-03 residual, confirmed not fixed here)", async () => {
      const itemName = `Bypass Item ${randomTag()}`;

      const { data, error } = await starterDoctorClient
        .from("inventory_items")
        .insert({
          clinic_id: starterClinicId,
          name: itemName,
          unit: "kom",
          quantity: 5,
          low_stock_threshold: 1,
          created_by: starterDoctor.userId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();

      const { data: reread } = await service
        .from("inventory_items")
        .select("id, clinic_id")
        .eq("id", data!.id)
        .single();
      expect(reread?.clinic_id).toBe(starterClinicId);
    });

    it("PLAN-SEC-001 / D-03: createInventoryItemAction blocks the real Server Action path on a Starter clinic (SA-level defense)", async () => {
      activeActionClient = starterDoctorClient;
      const itemName = `SA Blocked ${randomTag()}`;

      const result = await createInventoryItemAction(
        null,
        inventoryFormData(itemName),
      );

      expect(result?.error).toBe("featureDisabled");

      const finalCount = await countInventoryItems(
        service,
        starterClinicId,
        "SA Blocked",
      );
      expect(finalCount).toBe(0);
    });

    it("createInventoryItemAction succeeds on a Professional clinic with inventory_basic entitled (positive control — SA block is entitlement-specific, not a broken RBAC/feature check)", async () => {
      activeActionClient = professionalDoctorClient;
      const itemName = `SA Allowed ${randomTag()}`;

      const result = await createInventoryItemAction(
        null,
        inventoryFormData(itemName),
      );

      expect(result?.message).toBe("created");

      const finalCount = await countInventoryItems(
        service,
        professionalClinicId,
        "SA Allowed",
      );
      expect(finalCount).toBe(1);
    });
  },
);
