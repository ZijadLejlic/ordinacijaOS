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
 * P4.7 (docs/QA/Implementation-Plan.md): CSV import dry-run + commit INT.
 * Closes `IMP-INT-001` / D30 / §6.14 / §12.1 CSV import.
 *
 * **Mechanism (grepped, not assumed):**
 * - `importPatientsAction` / `importServicesAction` (`lib/import/actions.ts`):
 *   `mode=preview` (default) → parse + map only (no INSERT); `mode=commit`
 *   → if any `rowErrors` return `hasRowErrors` and **do not** insert;
 *   clean commit inserts chunks + audit `patients_csv_imported` /
 *   `services_csv_imported` with `{ count }` only (no PII).
 * - Patients: owner + `assertFeature(patients_chart)`. Services: owner|
 *   accountant (`canImportServices`). Caps: 500 rows / 1 MB (`MAX_CSV_*`).
 * - Parse/map unit = `IMP-UNIT-001`. Oversized reject = `IMP-INT-002` (COVERED
 *   in `csv-import-caps.test.ts`). RBAC deny = `RBAC-INT-016`.
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
  importPatientsAction,
  importServicesAction,
} from "@/lib/import/actions";

function csvFile(name: string, content: string): File {
  return new File([content], name, { type: "text/csv" });
}

function importForm(
  mode: "preview" | "commit",
  content: string,
  filename: string,
): FormData {
  const fd = new FormData();
  fd.set("mode", mode);
  fd.set("file", csvFile(filename, content));
  return fd;
}

describeSecurity("P4.7 CSV import dry-run+commit (IMP-INT-001)", () => {
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
      clinicName: `IMP-INT-001 CSV ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "imp-int-001",
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

  it("IMP-INT-001 patients: preview surfaces errors; commit blocked; clean commit OK", async () => {
    activeActionClient = ownerClient;

    const badCsv = [
      "first_name,last_name,phone,email",
      `Good,ImpGood${tag},+38761111111,good-${tag}@ordinacijaos.test`,
      `,ImpBad${tag},+38762222222,`, // missing first_name
    ].join("\n");

    const preview = await importPatientsAction(
      null,
      importForm("preview", badCsv, "patients.csv"),
    );
    expect(preview?.error).toBeUndefined();
    expect(preview?.mode).toBe("preview");
    expect(preview?.totalCount).toBe(2);
    expect(preview?.validCount).toBe(1);
    expect(preview?.errorCount).toBe(1);
    expect(preview?.rowErrors?.length).toBeGreaterThanOrEqual(1);
    expect(preview?.rowErrors?.[0]?.rowNumber).toBe(3);

    const { count: beforeBad } = await service
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .ilike("last_name", `Imp%${tag}`);
    expect(beforeBad ?? 0).toBe(0);

    const blocked = await importPatientsAction(
      null,
      importForm("commit", badCsv, "patients.csv"),
    );
    expect(blocked?.error).toBe("hasRowErrors");
    expect(blocked?.mode).toBe("commit");
    expect(blocked?.errorCount).toBe(1);
    expect(blocked?.importedCount).toBeUndefined();

    const { count: afterBad } = await service
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .ilike("last_name", `Imp%${tag}`);
    expect(afterBad ?? 0).toBe(0);

    const { count: auditBlocked } = await service
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("event_name", "patients_csv_imported");
    expect(auditBlocked ?? 0).toBe(0);

    const goodCsv = [
      "first_name,last_name,phone,email",
      `Ana,ImpCommitA${tag},+38761111111,ana-${tag}@ordinacijaos.test`,
      `Marko,ImpCommitB${tag},+38762222222,marko-${tag}@ordinacijaos.test`,
    ].join("\n");

    const dryOk = await importPatientsAction(
      null,
      importForm("preview", goodCsv, "patients.csv"),
    );
    expect(dryOk?.error).toBeUndefined();
    expect(dryOk?.validCount).toBe(2);
    expect(dryOk?.errorCount).toBe(0);

    const committed = await importPatientsAction(
      null,
      importForm("commit", goodCsv, "patients.csv"),
    );
    expect(committed?.error).toBeUndefined();
    expect(committed?.message).toBe("patientsImported");
    expect(committed?.importedCount).toBe(2);

    const { data: rows } = await service
      .from("patients")
      .select("first_name, last_name, email")
      .eq("clinic_id", clinicId)
      .ilike("last_name", `ImpCommit%${tag}`)
      .order("last_name");
    expect(rows).toHaveLength(2);
    expect(rows?.map((r) => r.first_name).sort()).toEqual(["Ana", "Marko"]);

    const { data: audits } = await service
      .from("audit_events")
      .select("event_name, payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "patients_csv_imported");
    expect(audits).toHaveLength(1);
    expect(audits?.[0]?.payload_json).toEqual({ count: 2 });
  }, 60_000);

  it("IMP-INT-001 services: preview errors block commit; clean commit inserts + audit", async () => {
    activeActionClient = ownerClient;

    const badCsv = [
      "name,price_eur,duration_minutes,vat_rate,code",
      `GoodSvc${tag},50,30,0.17,G${tag}`,
      `BadSvc${tag},not-a-price,30,0.17,B${tag}`,
    ].join("\n");

    const preview = await importServicesAction(
      null,
      importForm("preview", badCsv, "services.csv"),
    );
    expect(preview?.error).toBeUndefined();
    expect(preview?.mode).toBe("preview");
    expect(preview?.totalCount).toBe(2);
    expect(preview?.validCount).toBe(1);
    expect(preview?.errorCount).toBe(1);
    expect(preview?.rowErrors?.[0]?.message).toMatch(/price/i);

    const blocked = await importServicesAction(
      null,
      importForm("commit", badCsv, "services.csv"),
    );
    expect(blocked?.error).toBe("hasRowErrors");
    expect(blocked?.importedCount).toBeUndefined();

    const { count: afterBad } = await service
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .ilike("name", `%${tag}%`);
    expect(afterBad ?? 0).toBe(0);

    const goodCsv = [
      "name,price_eur,duration_minutes,vat_rate,code",
      `Plomba${tag},80.50,45,0.17,P${tag}`,
      `Pregled${tag},40,30,17,R${tag}`,
    ].join("\n");

    const committed = await importServicesAction(
      null,
      importForm("commit", goodCsv, "services.csv"),
    );
    expect(committed?.error).toBeUndefined();
    expect(committed?.message).toBe("servicesImported");
    expect(committed?.importedCount).toBe(2);

    const { data: rows } = await service
      .from("services")
      .select("name, price_eur, vat_rate, duration_minutes, code")
      .eq("clinic_id", clinicId)
      .in("code", [`P${tag}`, `R${tag}`])
      .order("name");
    expect(rows).toHaveLength(2);
    expect(Number(rows?.find((r) => r.code === `P${tag}`)?.price_eur)).toBe(
      80.5,
    );
    expect(Number(rows?.find((r) => r.code === `R${tag}`)?.vat_rate)).toBe(
      0.17,
    );

    const { data: audits } = await service
      .from("audit_events")
      .select("event_name, payload_json")
      .eq("clinic_id", clinicId)
      .eq("event_name", "services_csv_imported");
    expect(audits).toHaveLength(1);
    expect(audits?.[0]?.payload_json).toEqual({ count: 2 });
  }, 60_000);
});
