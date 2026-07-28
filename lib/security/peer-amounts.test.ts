import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type ClinicWithRoles,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P2.3 (docs/QA/Implementation-Plan.md): peer amounts setting.
 * Closes `FIN-INT-020` / Threat-Model `T-FIN-05` / BR-F10 / D17.
 *
 * Where the boundary lives (read before asserting — not assumed):
 *   - `clinics.settings_json` default in
 *     `supabase/migrations/20260712900001_phase1_foundation.sql`:
 *     `doctors_see_peer_amounts` → **false** (Discrepancies D-17 pin).
 *   - `public.dashboard_payment_stats(...)` in
 *     `supabase/migrations/20260713250000_phase2e_expenses.sql`
 *     (live `pg_get_functiondef` matches). SECURITY DEFINER; reads
 *     `settings_json ->> 'doctors_see_peer_amounts'` with
 *     `coalesce(..., false)`. Owner/accountant always see all clinic
 *     payments; doctor sees own invoice payments unless `v_peer`;
 *     `by_doctor` is full clinic aggregate when peer/owner/accountant,
 *     else a single-element array of the caller's month total.
 *   - App call site `lib/dashboard/kpi.ts` only forwards the RPC result
 *     when `includeFinance` — no second gate. Pattern: **P1.4**
 *     (authenticated doctor JWT → RPC directly; no SA/`vi.mock`).
 *
 * Catalog: setting false; 2 doctors → doctor sees only own.
 */

type PaymentStats = {
  today_revenue: number;
  month_revenue: number;
  by_doctor: Array<{
    doctor_id: string;
    doctor_name: string;
    amount: number;
  }>;
  trend: Array<{ month: string; revenue: number }>;
};

function parseStats(raw: unknown): PaymentStats {
  if (!raw || typeof raw !== "object") {
    throw new Error("dashboard_payment_stats returned non-object");
  }
  const o = raw as Record<string, unknown>;
  const byDoctor = Array.isArray(o.by_doctor) ? o.by_doctor : [];
  const trend = Array.isArray(o.trend) ? o.trend : [];
  return {
    today_revenue: Number(o.today_revenue),
    month_revenue: Number(o.month_revenue),
    by_doctor: byDoctor.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        doctor_id: String(r.doctor_id),
        doctor_name: String(r.doctor_name),
        amount: Number(r.amount),
      };
    }),
    trend: trend.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        month: String(r.month),
        revenue: Number(r.revenue),
      };
    }),
  };
}

/** Wide windows around `now` so fixture payments (paid_at = default now()) are in range. */
function rpcWindows(now = Date.now()) {
  return {
    p_today_start: new Date(now - 3_600_000).toISOString(),
    p_today_end: new Date(now + 3_600_000).toISOString(),
    p_month_start: new Date(now - 15 * 86_400_000).toISOString(),
    p_month_end: new Date(now + 86_400_000).toISOString(),
    p_trend_start: new Date(now - 90 * 86_400_000).toISOString(),
  };
}

async function createInvoiceWithPayment(
  service: DbClient,
  opts: {
    clinicId: string;
    patientId: string;
    doctorId: string;
    issuedBy: string;
    amount: number;
  },
): Promise<{ invoiceId: string }> {
  const { data: invoice, error: invoiceError } = await service
    .from("invoices")
    .insert({
      clinic_id: opts.clinicId,
      patient_id: opts.patientId,
      doctor_id: opts.doctorId,
      series_year: 2026,
      series_number: Math.floor(Math.random() * 900_000) + 100_000,
      subtotal_amount: opts.amount,
      vat_amount: 0,
      total_amount: opts.amount,
      issued_by: opts.issuedBy,
      status: "paid",
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "invoice insert failed");
  }

  const { error: paymentError } = await service.from("payments").insert({
    clinic_id: opts.clinicId,
    invoice_id: invoice.id,
    amount: opts.amount,
    method: "cash",
    recorded_by: opts.issuedBy,
  });
  if (paymentError) {
    throw new Error(paymentError.message);
  }

  return { invoiceId: invoice.id };
}

const OWN_AMOUNT = 100;
const PEER_AMOUNT = 250;
const CLINIC_TOTAL = OWN_AMOUNT + PEER_AMOUNT;

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("P2.3 peer amounts (FIN-INT-020)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinic: ClinicWithRoles;
  let owner: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let allUsers: TestUser[] = [];
  /** Captured in beforeAll before any settings_json write (D-17 pin). */
  let defaultPeerAmounts: unknown;

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    clinic = await createClinicWithRoles(service, {
      emailPrefix: "peer-amt",
      clinicName: `Peer Amounts ${Date.now()}`,
      // Two doctors: byRole.doctor is the last one; keep both via users[].
      roles: ["owner", "doctor", "doctor"],
    });
    owner = clinic.byRole.owner!;
    const doctors = clinic.users.filter((u) => u.role === "doctor");
    if (doctors.length !== 2) {
      throw new Error(`expected 2 doctors, got ${doctors.length}`);
    }
    doctorA = doctors[0]!;
    doctorB = doctors[1]!;
    allUsers = [...clinic.users];

    const { data: clinicRow, error: settingsError } = await service
      .from("clinics")
      .select("settings_json")
      .eq("id", clinic.clinicId)
      .single();
    if (settingsError || !clinicRow) {
      throw new Error(settingsError?.message ?? "settings_json read failed");
    }
    const settings = clinicRow.settings_json as Record<string, unknown>;
    defaultPeerAmounts = settings.doctors_see_peer_amounts;

    const patient = await createPatient(service, clinic.clinicId, {
      firstName: "PeerAmt",
      lastName: `Patient${randomTag().slice(-6)}`,
    });

    await createInvoiceWithPayment(service, {
      clinicId: clinic.clinicId,
      patientId: patient.id,
      doctorId: doctorA.userId,
      issuedBy: owner.userId,
      amount: OWN_AMOUNT,
    });
    await createInvoiceWithPayment(service, {
      clinicId: clinic.clinicId,
      patientId: patient.id,
      doctorId: doctorB.userId,
      issuedBy: owner.userId,
      amount: PEER_AMOUNT,
    });
  }, 120_000);

  afterAll(async () => {
    if (!service || allUsers.length === 0) return;
    await cleanupClinics(service, allUsers);
  }, 120_000);

  it("D-17: clinics.settings_json default pins doctors_see_peer_amounts = false", () => {
    expect(defaultPeerAmounts).toBe(false);
  });

  it("FIN-INT-020: setting false → doctor sees only own revenue (not peer)", async () => {
    // Ensure false even if a prior test flipped it (order-independent).
    const { error: setError } = await service
      .from("clinics")
      .update({
        settings_json: {
          doctors_see_peer_amounts: false,
          shared_pricelist_across_locations: true,
          ai_enabled: false,
        },
      })
      .eq("id", clinic.clinicId);
    expect(setError).toBeNull();

    const clientA = await signInAs(
      url,
      anonKey,
      doctorA.email,
      doctorA.password,
    );
    const { data, error } = await clientA.rpc(
      "dashboard_payment_stats",
      rpcWindows(),
    );
    expect(error, error?.message).toBeNull();
    const stats = parseStats(data);

    expect(stats.today_revenue).toBe(OWN_AMOUNT);
    expect(stats.month_revenue).toBe(OWN_AMOUNT);
    expect(stats.by_doctor).toHaveLength(1);
    expect(stats.by_doctor[0]).toMatchObject({
      doctor_id: doctorA.userId,
      amount: OWN_AMOUNT,
    });
    // Must not leak peer identity or amount in by_doctor.
    expect(
      stats.by_doctor.some((d) => d.doctor_id === doctorB.userId),
    ).toBe(false);
    expect(stats.today_revenue).not.toBe(CLINIC_TOTAL);
    expect(stats.month_revenue).not.toBe(CLINIC_TOTAL);

    const trendOwn = stats.trend.reduce((acc, t) => acc + t.revenue, 0);
    expect(trendOwn).toBe(OWN_AMOUNT);
  });

  it("FIN-INT-020 positive: setting true → same doctor sees peer + full by_doctor", async () => {
    const { error: setError } = await service
      .from("clinics")
      .update({
        settings_json: {
          doctors_see_peer_amounts: true,
          shared_pricelist_across_locations: true,
          ai_enabled: false,
        },
      })
      .eq("id", clinic.clinicId);
    expect(setError).toBeNull();

    const clientA = await signInAs(
      url,
      anonKey,
      doctorA.email,
      doctorA.password,
    );
    const { data, error } = await clientA.rpc(
      "dashboard_payment_stats",
      rpcWindows(),
    );
    expect(error, error?.message).toBeNull();
    const stats = parseStats(data);

    expect(stats.today_revenue).toBe(CLINIC_TOTAL);
    expect(stats.month_revenue).toBe(CLINIC_TOTAL);

    const ids = new Set(stats.by_doctor.map((d) => d.doctor_id));
    expect(ids.has(doctorA.userId)).toBe(true);
    expect(ids.has(doctorB.userId)).toBe(true);
    expect(
      stats.by_doctor.find((d) => d.doctor_id === doctorA.userId)?.amount,
    ).toBe(OWN_AMOUNT);
    expect(
      stats.by_doctor.find((d) => d.doctor_id === doctorB.userId)?.amount,
    ).toBe(PEER_AMOUNT);

    // Owner always sees clinic total (control: gate is peer setting, not broken RPC).
    const ownerClient = await signInAs(
      url,
      anonKey,
      owner.email,
      owner.password,
    );
    const ownerStats = parseStats(
      (
        await ownerClient.rpc("dashboard_payment_stats", rpcWindows())
      ).data,
    );
    expect(ownerStats.month_revenue).toBe(CLINIC_TOTAL);
    expect(ownerStats.by_doctor.length).toBeGreaterThanOrEqual(2);
  });
});
