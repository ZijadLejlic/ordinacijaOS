import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";
import { formatInvoiceNumber } from "@/lib/invoices/money";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  signInAs,
  type ClinicWithRoles,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P2.1 (docs/QA/Implementation-Plan.md): `allocate_invoice_number` same-clinic
 * + MFA + concurrency. Closes `FIN-SEC-001`, `FIN-DB-001`, `FIN-INT-001` /
 * Threat-Model `T-FIN-01` / `T-FIN-02` / AC4.
 *
 * Where the boundary lives (read before asserting):
 *   - `supabase/migrations/20260714040000_fix_allocate_invoice_number.sql`
 *     — final `public.allocate_invoice_number(p_clinic_id uuid)` SECURITY
 *     DEFINER body (phase2d intentionally does NOT redefine it). Checks, in
 *     order: `p_clinic_id = current_clinic_id()` else `forbidden_clinic`;
 *     `can_write_invoices()` else `forbidden`; `owner_mfa_ok()` else
 *     `owner_mfa_required`; then `INSERT … ON CONFLICT DO UPDATE` on
 *     `invoice_number_counters` (row lock) returning the next serial. Year
 *     from `timezone('Europe/Sarajevo', now())` (BR-F01).
 *   - `GRANT EXECUTE … TO authenticated`; `REVOKE … FROM public, anon`.
 *   - App call site `lib/invoices/allocate-number.ts` wraps the same RPC
 *     only (no service-role fallback — D-14 / P2.9 removed dead path).
 *     P2.1's first live probe proved the prior "fix" migration still left
 *     ON CONFLICT `(clinic_id, series_year)` ambiguous under RETURNS TABLE
 *     (Postgres 42702). Fixed in
 *     `20260728010000_fix_allocate_invoice_number_on_conflict`
 *     (`ON CONFLICT ON CONSTRAINT invoice_number_counters_pkey`). These IDs
 *     assert the DB RPC itself (P1.4 pattern: authenticated JWT → RPC).
 *
 * Actor choice: **accountant** (not owner). `can_write_invoices()` is
 * owner+accountant; using accountant keeps `owner_mfa_ok()` always true
 * (non-owners short-circuit) so a denial cannot be an MFA false-negative.
 * MFA gate itself is already COVERED by `AUTH-RLS-001` (P1.3) against the
 * same `owner_mfa_ok()` helper this RPC calls.
 *
 * Pattern: P1.4 (DB logic → RPC direct via authenticated client). No
 * `vi.mock` / server-action harness — `allocateInvoiceNumber()`'s only
 * security-relevant path is this RPC.
 */

const CONCURRENCY = 12;

function sarajevoYear(now = new Date()): number {
  return Number(formatInTimeZone(now, CLINIC_TIMEZONE, "yyyy"));
}

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("P2.1 allocate_invoice_number (FIN-SEC/DB/INT-001)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinicA: ClinicWithRoles;
  let clinicB: ClinicWithRoles;
  let accountantA: TestUser;
  let accountantB: TestUser;
  let allUsers: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    clinicA = await createClinicWithRoles(service, {
      emailPrefix: "alloc-a",
      clinicName: `Allocate A ${Date.now()}`,
      roles: ["owner", "accountant"],
    });
    clinicB = await createClinicWithRoles(service, {
      emailPrefix: "alloc-b",
      clinicName: `Allocate B ${Date.now()}`,
      roles: ["owner", "accountant"],
    });

    accountantA = clinicA.byRole.accountant!;
    accountantB = clinicB.byRole.accountant!;
    allUsers = [...clinicA.users, ...clinicB.users];
  }, 120_000);

  afterAll(async () => {
    if (!service || allUsers.length === 0) return;
    await cleanupClinics(service, allUsers);
  }, 120_000);

  it("FIN-SEC-001: clinic A JWT cannot allocate for clinic B (forbidden_clinic)", async () => {
    const clientA = await signInAs(
      url,
      anonKey,
      accountantA.email,
      accountantA.password,
    );

    const { data, error } = await clientA.rpc("allocate_invoice_number", {
      p_clinic_id: clinicB.clinicId,
    });

    expect(error, "cross-clinic allocate must fail").not.toBeNull();
    expect(error?.message ?? "").toMatch(/forbidden_clinic/i);
    expect(data).toBeNull();

    // Positive control: same-clinic allocate succeeds (proves the harness
    // isn't denying every call, and that accountant passes can_write_invoices).
    const own = await clientA.rpc("allocate_invoice_number", {
      p_clinic_id: clinicA.clinicId,
    });
    expect(own.error).toBeNull();
    expect(own.data?.[0]).toMatchObject({
      series_year: sarajevoYear(),
      series_number: expect.any(Number),
    });
    expect(own.data![0]!.series_number).toBeGreaterThanOrEqual(1);
  });

  it("FIN-DB-001: parallel allocate yields unique serials (no duplicates)", async () => {
    const clientB = await signInAs(
      url,
      anonKey,
      accountantB.email,
      accountantB.password,
    );

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        clientB.rpc("allocate_invoice_number", {
          p_clinic_id: clinicB.clinicId,
        }),
      ),
    );

    for (const r of results) {
      expect(r.error, r.error?.message).toBeNull();
      expect(r.data?.[0]).toBeTruthy();
    }

    const numbers = results.map((r) => r.data![0]!.series_number);
    expect(new Set(numbers).size, "duplicate serials under concurrency").toBe(
      CONCURRENCY,
    );
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(CONCURRENCY);

    // Counter row must land at CONCURRENCY (service-role read — table has
    // RLS enabled with no direct policies; only the RPC mutates it).
    const year = sarajevoYear();
    const { data: counter, error: counterError } = await service
      .from("invoice_number_counters")
      .select("last_number")
      .eq("clinic_id", clinicB.clinicId)
      .eq("series_year", year)
      .maybeSingle();

    expect(counterError).toBeNull();
    expect(counter?.last_number).toBe(CONCURRENCY);
  });

  it("FIN-INT-001: allocated series formats as YYYY-#### (Sarajevo year)", async () => {
    const clientA = await signInAs(
      url,
      anonKey,
      accountantA.email,
      accountantA.password,
    );

    const { data, error } = await clientA.rpc("allocate_invoice_number", {
      p_clinic_id: clinicA.clinicId,
    });

    expect(error).toBeNull();
    const row = data?.[0];
    expect(row).toBeTruthy();

    const year = sarajevoYear();
    expect(row!.series_year).toBe(year);
    expect(row!.series_number).toBeGreaterThanOrEqual(1);

    const formatted = formatInvoiceNumber(row!.series_year, row!.series_number);
    expect(formatted).toMatch(/^\d{4}-\d{4}$/);
    expect(formatted).toBe(
      `${year}-${String(row!.series_number).padStart(4, "0")}`,
    );
    // BR-F01: display uses Europe/Sarajevo year, not UTC — same helper the
    // PDF/actions path uses (`formatInvoiceNumber` + CLINIC_TIMEZONE).
    expect(year).toBe(
      Number(formatInTimeZone(new Date(), "Europe/Sarajevo", "yyyy")),
    );
  });
});
