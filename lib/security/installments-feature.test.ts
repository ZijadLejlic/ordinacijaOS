import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  resolvePlanId,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P6a — FIN-INT-010 (D29 / D42): installments_calculator on Starter.
 *
 * **Mechanism (read, not invented):**
 * `createPaymentPlanAction` (`lib/invoices/actions.ts`) calls
 * `clinicHasFeature(..., "installments_calculator")` after `assertFeature("invoices")`.
 * Seed: starter=false, professional=true. Returns `{ error: "featureDisabled" }`
 * when missing — same family as PLAN-INT-011 SA gates (uses clinicHasFeature,
 * not assertFeature).
 *
 * Pattern: P1.6 / P3.5 SA. Starter deny + Pro positive control.
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

import { createPaymentPlanAction } from "@/lib/invoices/actions";

async function createUnpaidInvoice(
  service: DbClient,
  clinicId: string,
  patientId: string,
  issuedBy: string,
  totalAmount: number,
): Promise<string> {
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
  return data.id;
}

describeSecurity("installments feature gate (FIN-INT-010)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let starterAccountant: TestUser;
  let starterInvoiceId: string;
  let proAccountant: TestUser;
  let proInvoiceId: string;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const starter = await createClinicWithRoles(service, {
      roles: ["owner", "accountant"],
      clinicName: `FIN-INT-010 Starter ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "fin-int-010-s",
    });
    starterAccountant = starter.byRole.accountant!;
    created.push(...starter.users);
    const starterPatient = await createPatient(service, starter.clinicId);
    starterInvoiceId = await createUnpaidInvoice(
      service,
      starter.clinicId,
      starterPatient.id,
      starterAccountant.userId,
      300,
    );

    const pro = await createClinicWithRoles(service, {
      roles: ["owner", "accountant"],
      clinicName: `FIN-INT-010 Pro ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "fin-int-010-p",
    });
    proAccountant = pro.byRole.accountant!;
    created.push(...pro.users);
    const proPatient = await createPatient(service, pro.clinicId);
    proInvoiceId = await createUnpaidInvoice(
      service,
      pro.clinicId,
      proPatient.id,
      proAccountant.userId,
      300,
    );

    for (const [code, expected] of [
      ["starter", false],
      ["professional", true],
    ] as const) {
      const planId = await resolvePlanId(service, code);
      const { data: ent, error: entError } = await service
        .from("plan_entitlements")
        .select("enabled")
        .eq("plan_id", planId)
        .eq("feature_key", "installments_calculator")
        .single();
      if (entError || !ent) {
        throw new Error(
          entError?.message ??
            `${code} installments_calculator entitlement missing`,
        );
      }
      if (ent.enabled !== expected) {
        throw new Error(
          `${code} installments_calculator enabled=${ent.enabled}, expected ${expected}`,
        );
      }
    }
  }, 90_000);

  afterAll(async () => {
    if (!service || created.length === 0) return;
    await cleanupClinics(service, created);
  });

  it("starter createPaymentPlanAction returns featureDisabled", async () => {
    activeActionClient = await signInAs(
      url,
      anonKey,
      starterAccountant.email,
      starterAccountant.password,
    );

    const fd = new FormData();
    fd.set("invoiceId", starterInvoiceId);
    fd.set("installmentCount", "3");
    fd.set("firstDueDate", "2026-09-01");
    fd.set("notes", "");

    const result = await createPaymentPlanAction(null, fd);
    expect(result).toEqual({ error: "featureDisabled" });

    const { count } = await service
      .from("payment_plans")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", starterInvoiceId);
    expect(count ?? 0).toBe(0);
  }, 60_000);

  it("professional createPaymentPlanAction creates plan (positive control)", async () => {
    activeActionClient = await signInAs(
      url,
      anonKey,
      proAccountant.email,
      proAccountant.password,
    );

    const fd = new FormData();
    fd.set("invoiceId", proInvoiceId);
    fd.set("installmentCount", "3");
    fd.set("firstDueDate", "2026-09-01");
    fd.set("notes", "");

    const result = await createPaymentPlanAction(null, fd);
    expect(result).toEqual({ message: "planCreated" });

    const { data: plan, error } = await service
      .from("payment_plans")
      .select("id, installment_count, status")
      .eq("invoice_id", proInvoiceId)
      .eq("status", "active")
      .single();
    expect(error).toBeNull();
    expect(plan!.installment_count).toBe(3);

    const { count } = await service
      .from("payment_plan_installments")
      .select("id", { count: "exact", head: true })
      .eq("payment_plan_id", plan!.id);
    expect(count).toBe(3);
  }, 60_000);
});
