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

/**
 * P3.7 (docs/QA/Implementation-Plan.md): FIN-INT-015 / Discrepancies D-08 —
 * invoice legal settings gates.
 *
 * Mechanism (read, not invented):
 *   updateInvoiceLegalSettingsAction → requireInvoiceWriter() (canWriteInvoices
 *   + getClinicWriteBlock) → extra owner-only check → assertFeature("invoices")
 *   → clinics.settings_json patch.
 *
 * Already COVERED elsewhere — not duplicated:
 *   - LIFE-RLS-001 SA write-block matrix (clinic-write-block-sa) createInvoice
 *   - FIN-API-001/002, FIN-INT-001/003/004, FIN-RLS-001, FIN-SEC-001
 *   - PLAN-INT-011 (invoices is starter-enabled — not a Pro-only starter deny)
 *
 * D-08 correction: getClinicWriteBlock is NOT missing — it lives inside
 * requireInvoiceWriter. Residual was assertFeature("invoices") inconsistency
 * vs createInvoiceAction (product fix in this phase).
 *
 * Pattern: P1.6 / P3.5 / P3.6 SA (vi.mock Next + createClinicWithRoles + real action).
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
    throw new Error("unexpected redirect in FIN-INT-015");
  },
  getPathname: () => "/",
  Link: () => null,
  usePathname: () => "/",
  useRouter: () => ({ push: () => undefined }),
}));

import { updateInvoiceLegalSettingsAction } from "@/lib/invoices/actions";

function legalFormData(legalName: string, taxId: string): FormData {
  const fd = new FormData();
  fd.set("legalName", legalName);
  fd.set("taxId", taxId);
  return fd;
}

describeSecurity("P3.7 FIN-INT-015 invoice legal settings gates (D-08)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  const created: TestUser[] = [];

  let writableClinicId: string;
  let readonlyClinicId: string;
  let writableOwner: TestUser;
  let writableAccountant: TestUser;
  let readonlyOwner: TestUser;

  let writableOwnerClient: DbClient;
  let writableAccountantClient: DbClient;
  let readonlyOwnerClient: DbClient;

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const writable = await createClinicWithRoles(service, {
      roles: ["owner", "accountant"],
      clinicName: `FIN-INT-015 Writable ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "fin-int-015-w",
    });
    writableClinicId = writable.clinicId;
    writableOwner = writable.byRole.owner!;
    writableAccountant = writable.byRole.accountant!;
    created.push(...writable.users);

    const readonly = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `FIN-INT-015 Readonly ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "fin-int-015-r",
    });
    readonlyClinicId = readonly.clinicId;
    readonlyOwner = readonly.byRole.owner!;
    created.push(...readonly.users);

    const { error: statusErr } = await service
      .from("clinics")
      .update({ status: "readonly" })
      .eq("id", readonlyClinicId);
    if (statusErr) {
      throw new Error(`readonly status set failed: ${statusErr.message}`);
    }

    writableOwnerClient = await signInAs(
      url,
      anonKey,
      writableOwner.email,
      writableOwner.password,
    );
    writableAccountantClient = await signInAs(
      url,
      anonKey,
      writableAccountant.email,
      writableAccountant.password,
    );
    readonlyOwnerClient = await signInAs(
      url,
      anonKey,
      readonlyOwner.email,
      readonlyOwner.password,
    );
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  it("FIN-INT-015: owner + writable clinic → settingsSaved", async () => {
    activeActionClient = writableOwnerClient;
    const legalName = `Legal ${randomTag().slice(-8)}`;
    const taxId = `TAX-${randomTag().slice(-6)}`;

    const result = await updateInvoiceLegalSettingsAction(
      null,
      legalFormData(legalName, taxId),
    );

    expect(result).toEqual({ message: "settingsSaved" });

    const { data: clinic, error } = await service
      .from("clinics")
      .select("settings_json")
      .eq("id", writableClinicId)
      .single();
    expect(error).toBeNull();
    const settings = (clinic?.settings_json ?? {}) as Record<string, unknown>;
    expect(settings.legal_name).toBe(legalName);
    expect(settings.tax_id).toBe(taxId);
  });

  it("FIN-INT-015: owner + readonly clinic → clinicReadonly (via requireInvoiceWriter)", async () => {
    activeActionClient = readonlyOwnerClient;

    const { data: before } = await service
      .from("clinics")
      .select("settings_json")
      .eq("id", readonlyClinicId)
      .single();
    const beforeSettings = (before?.settings_json ?? {}) as Record<
      string,
      unknown
    >;

    const result = await updateInvoiceLegalSettingsAction(
      null,
      legalFormData("Should Not Persist", "BLOCKED-TAX"),
    );

    expect(result).toEqual({ error: "clinicReadonly" });

    const { data: after } = await service
      .from("clinics")
      .select("settings_json")
      .eq("id", readonlyClinicId)
      .single();
    const afterSettings = (after?.settings_json ?? {}) as Record<string, unknown>;
    expect(afterSettings.legal_name).toBe(beforeSettings.legal_name);
    expect(afterSettings.tax_id).toBe(beforeSettings.tax_id);
  });

  it("FIN-INT-015: accountant (canWriteInvoices) → forbidden (owner-only extra check)", async () => {
    activeActionClient = writableAccountantClient;

    const result = await updateInvoiceLegalSettingsAction(
      null,
      legalFormData("Accountant Legal", "ACC-TAX"),
    );

    expect(result).toEqual({ error: "forbidden" });
  });
});
