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
import { MAX_CSV_BYTES, MAX_CSV_ROWS } from "@/lib/import/csv";

/**
 * P6b — IMP-INT-002 (D30): oversized CSV >1MB / >500 rows → rejected.
 *
 * **Mechanism (read, not invented):**
 * `readCsvFile` in `lib/import/actions.ts` rejects `file.size > MAX_CSV_BYTES`
 * (1_000_000) with `fileTooLarge` before parse. After `parseCsv`, both
 * `importPatientsAction` and `importServicesAction` reject
 * `parsed.rows.length > MAX_CSV_ROWS` (500) with `tooManyRows`.
 * Dry-run/commit correctness = `IMP-INT-001` (not duplicated here).
 *
 * Pattern: P1.6 SA (`vi.mock` Next + real actions).
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

import { importPatientsAction } from "@/lib/import/actions";

function importForm(content: string | Blob, filename: string): FormData {
  const fd = new FormData();
  fd.set("mode", "preview");
  fd.set(
    "file",
    content instanceof Blob
      ? new File([content], filename, { type: "text/csv" })
      : new File([content], filename, { type: "text/csv" }),
  );
  return fd;
}

describeSecurity("CSV import size/row caps (IMP-INT-002 / D30)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let owner: TestUser;
  let ownerClient: DbClient;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `IMP-INT-002 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "imp-int-002",
    });
    owner = clinic.byRole.owner!;
    created.push(...clinic.users);

    ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    activeActionClient = ownerClient;
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  });

  it("IMP-INT-002: CSV > MAX_CSV_BYTES → fileTooLarge (no patients)", async () => {
    activeActionClient = ownerClient;
    // Pad past the byte cap without needing 500+ valid rows.
    const header = "first_name,last_name,phone\n";
    const pad = "x".repeat(MAX_CSV_BYTES - header.length + 1);
    const blob = new Blob([header, pad], { type: "text/csv" });
    expect(blob.size).toBeGreaterThan(MAX_CSV_BYTES);

    const result = await importPatientsAction(
      null,
      importForm(blob, "huge.csv"),
    );
    expect(result?.error).toBe("fileTooLarge");
    expect(result?.kind).toBe("patients");

    const { count } = await service
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", owner.clinicId);
    expect(count ?? 0).toBe(0);
  });

  it("IMP-INT-002: > MAX_CSV_ROWS → tooManyRows (no patients)", async () => {
    activeActionClient = ownerClient;
    const lines = ["first_name,last_name,phone"];
    for (let i = 0; i < MAX_CSV_ROWS + 1; i++) {
      lines.push(`Ime${i},Prezime${i},+38761000000`);
    }
    const content = lines.join("\n");
    expect(content.length).toBeLessThanOrEqual(MAX_CSV_BYTES);

    const result = await importPatientsAction(
      null,
      importForm(content, "many-rows.csv"),
    );
    expect(result?.error).toBe("tooManyRows");
    expect(result?.kind).toBe("patients");

    const { count } = await service
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", owner.clinicId);
    expect(count ?? 0).toBe(0);
  });
});
