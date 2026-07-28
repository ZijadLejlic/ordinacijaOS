import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
 * P2.2 (docs/QA/Implementation-Plan.md): payments / invoice_lines append-only
 * + void payment path. Closes `FIN-RLS-001`, `FIN-INT-003`, `FIN-INT-004` /
 * Threat-Model `T-FIN-03` (+ status machine BR-F02 / BR-F03 / BR-F04).
 *
 * Where the boundary lives (read before asserting — not assumed):
 *   - phase2d originally claimed append-only (SELECT+INSERT only) but shipped
 *     `*_owner_mfa_aal2` as **PERMISSIVE FOR ALL** — that alone granted
 *     DELETE/UPDATE to anyone passing `owner_mfa_ok()` (D-20).
 *   - Fix: `20260728020000_fix_finance_mfa_restrictive_append_only.sql`
 *     flips finance MFA policies to **RESTRICTIVE** (match expenses/patients)
 *     + `REVOKE UPDATE, DELETE` on `payments` / `invoice_lines` from
 *     anon/authenticated. Without a permissive UPDATE/DELETE policy, those
 *     commands are denied; REVOKE is defense in depth.
 *   - `recompute_invoice_payment_status()` AFTER INSERT on `payments`:
 *     sums payments → sets invoice `unpaid`/`partial`/`paid`. If the
 *     invoice is already `void`, the trigger **returns without raising**
 *     — it does not block the INSERT. There is no CHECK/RLS gate on
 *     `payments` that looks at invoice status.
 *   - `lib/invoices/actions.ts`:
 *     - `voidInvoiceAction` → UPDATE invoices to `void` + `voided_at`
 *     - `recordPaymentAction` → SA gate `if (status === "void") return
 *       { error: "invoiceVoid" }` **before** the payments INSERT
 *
 * **FIN-INT-004 residual** (documented, not blocking COVERED): PostgREST
 * INSERT on void invoice still succeeds; SA returns `invoiceVoid`.
 *
 * Actor = accountant (owner+accountant write invoices; accountant keeps
 * `owner_mfa_ok()` always true so denials cannot be MFA false-negatives).
 *
 * Patterns: FIN-RLS-001 / FIN-INT-003 → P1.1/P1.4 (authenticated JWT →
 * table/trigger); FIN-INT-004 SA gate → P1.6/P1.7 (`vi.mock` + real action).
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

// After mocks on purpose (Vitest hoists `vi.mock`). Real SA bodies.
import {
  recordPaymentAction,
  voidInvoiceAction,
} from "@/lib/invoices/actions";

async function createUnpaidInvoice(
  service: DbClient,
  clinicId: string,
  patientId: string,
  issuedBy: string,
  totalAmount: number,
): Promise<{ id: string }> {
  const { data, error } = await service
    .from("invoices")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      series_year: 2026,
      series_number: Math.floor(Math.random() * 900_000) + 100_000,
      subtotal_amount: totalAmount,
      vat_amount: 0,
      total_amount: totalAmount,
      issued_by: issuedBy,
      status: "unpaid",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "invoice insert failed");
  }
  return data;
}

async function createInvoiceLine(
  service: DbClient,
  clinicId: string,
  invoiceId: string,
  unitPrice: number,
): Promise<{ id: string }> {
  const { data, error } = await service
    .from("invoice_lines")
    .insert({
      clinic_id: clinicId,
      invoice_id: invoiceId,
      description: `Line ${randomTag().slice(-6)}`,
      quantity: 1,
      unit_price: unitPrice,
      vat_rate: 0,
      line_total: unitPrice,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "invoice_lines insert failed");
  }
  return data;
}

async function invoiceStatus(
  service: DbClient,
  invoiceId: string,
): Promise<string> {
  const { data, error } = await service
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "invoice status read failed");
  }
  return data.status;
}

describeSecurity("P2.2 payments append-only + void path (FIN-RLS/INT)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinic: ClinicWithRoles;
  let accountant: TestUser;
  let accountantClient: DbClient;
  let patientId: string;
  let allUsers: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    clinic = await createClinicWithRoles(service, {
      emailPrefix: "pay-void",
      clinicName: `Payments Void ${Date.now()}`,
      roles: ["owner", "accountant"],
    });
    accountant = clinic.byRole.accountant!;
    allUsers = [...clinic.users];

    accountantClient = await signInAs(
      url,
      anonKey,
      accountant.email,
      accountant.password,
    );

    const patient = await createPatient(service, clinic.clinicId, {
      firstName: "PayVoid",
      lastName: `Patient${randomTag().slice(-6)}`,
    });
    patientId = patient.id;
  }, 120_000);

  afterAll(async () => {
    if (!service || allUsers.length === 0) return;
    await cleanupClinics(service, allUsers);
  }, 120_000);

  it("FIN-RLS-001: finance writer DELETE/UPDATE on payments and invoice_lines denied (append-only)", async () => {
    const invoice = await createUnpaidInvoice(
      service,
      clinic.clinicId,
      patientId,
      accountant.userId,
      100,
    );
    const line = await createInvoiceLine(
      service,
      clinic.clinicId,
      invoice.id,
      100,
    );

    const { data: payment, error: paymentInsertError } = await accountantClient
      .from("payments")
      .insert({
        clinic_id: clinic.clinicId,
        invoice_id: invoice.id,
        amount: 25,
        method: "cash",
        recorded_by: accountant.userId,
      })
      .select("id")
      .single();
    expect(paymentInsertError).toBeNull();
    expect(payment?.id).toBeTruthy();

    // After D-20 fix: RESTRICTIVE MFA + REVOKE UPDATE/DELETE.
    // Privilege revoke surfaces as an explicit error; RLS-only deny on
    // UPDATE/DELETE without a matching permissive policy can also return
    // error:null + 0 rows — accept either, then prove the row is untouched.
    const delPayment = await accountantClient
      .from("payments")
      .delete()
      .eq("id", payment!.id)
      .select("id");
    expect(delPayment.data ?? []).toHaveLength(0);

    const { data: paymentAfterDelete } = await service
      .from("payments")
      .select("id")
      .eq("id", payment!.id)
      .maybeSingle();
    expect(paymentAfterDelete?.id).toBe(payment!.id);

    const updPayment = await accountantClient
      .from("payments")
      .update({ amount: 1, note: "tampered" })
      .eq("id", payment!.id)
      .select("id, amount, note");
    expect(updPayment.data ?? []).toHaveLength(0);

    const { data: paymentAfterUpdate } = await service
      .from("payments")
      .select("id, amount, note")
      .eq("id", payment!.id)
      .single();
    expect(Number(paymentAfterUpdate!.amount)).toBe(25);
    expect(paymentAfterUpdate!.note).toBeNull();

    const updLine = await accountantClient
      .from("invoice_lines")
      .update({ unit_price: 1, line_total: 1, description: "rewritten" })
      .eq("id", line.id)
      .select("id, unit_price, description");
    expect(updLine.data ?? []).toHaveLength(0);

    const { data: lineAfterUpdate } = await service
      .from("invoice_lines")
      .select("id, unit_price, description")
      .eq("id", line.id)
      .single();
    expect(Number(lineAfterUpdate!.unit_price)).toBe(100);
    expect(lineAfterUpdate!.description).not.toBe("rewritten");

    const delLine = await accountantClient
      .from("invoice_lines")
      .delete()
      .eq("id", line.id)
      .select("id");
    expect(delLine.data ?? []).toHaveLength(0);

    const { data: lineAfterDelete } = await service
      .from("invoice_lines")
      .select("id")
      .eq("id", line.id)
      .maybeSingle();
    expect(lineAfterDelete?.id).toBe(line.id);
  });

  it("FIN-INT-003: partial then full payment drives unpaid → partial → paid via trigger", async () => {
    const invoice = await createUnpaidInvoice(
      service,
      clinic.clinicId,
      patientId,
      accountant.userId,
      100,
    );
    expect(await invoiceStatus(service, invoice.id)).toBe("unpaid");

    const partial = await accountantClient
      .from("payments")
      .insert({
        clinic_id: clinic.clinicId,
        invoice_id: invoice.id,
        amount: 40,
        method: "card",
        recorded_by: accountant.userId,
      })
      .select("id")
      .single();
    expect(partial.error).toBeNull();
    expect(await invoiceStatus(service, invoice.id)).toBe("partial");

    const full = await accountantClient
      .from("payments")
      .insert({
        clinic_id: clinic.clinicId,
        invoice_id: invoice.id,
        amount: 60,
        method: "bank_transfer",
        recorded_by: accountant.userId,
      })
      .select("id")
      .single();
    expect(full.error).toBeNull();
    expect(await invoiceStatus(service, invoice.id)).toBe("paid");
  });

  it("FIN-INT-004: voidInvoiceAction + recordPaymentAction rejects payment (invoiceVoid); direct INSERT still succeeds (DB residual)", async () => {
    const invoice = await createUnpaidInvoice(
      service,
      clinic.clinicId,
      patientId,
      accountant.userId,
      80,
    );

    activeActionClient = accountantClient;

    const voidForm = new FormData();
    voidForm.set("invoiceId", invoice.id);
    voidForm.set("reason", "Test void — FIN-INT-004");
    const voidResult = await voidInvoiceAction(null, voidForm);
    expect(voidResult?.message).toBe("voided");
    expect(await invoiceStatus(service, invoice.id)).toBe("void");

    const payForm = new FormData();
    payForm.set("invoiceId", invoice.id);
    payForm.set("amount", "10");
    payForm.set("method", "cash");
    payForm.set("paidAt", "");
    payForm.set("note", "");
    const payResult = await recordPaymentAction(null, payForm);
    expect(payResult?.error).toBe("invoiceVoid");

    const { count: afterSa } = await service
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice.id);
    expect(afterSa ?? 0).toBe(0);

    // DB residual probe: same authenticated finance writer, PostgREST
    // bypass of the SA gate — INSERT is allowed; trigger no-ops on void.
    const bypass = await accountantClient
      .from("payments")
      .insert({
        clinic_id: clinic.clinicId,
        invoice_id: invoice.id,
        amount: 10,
        method: "cash",
        recorded_by: accountant.userId,
      })
      .select("id")
      .single();
    expect(bypass.error).toBeNull();
    expect(bypass.data?.id).toBeTruthy();
    expect(await invoiceStatus(service, invoice.id)).toBe("void");

    const { count: afterBypass } = await service
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice.id);
    expect(afterBypass ?? 0).toBe(1);
  });
});
