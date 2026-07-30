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
 * P2.4 (docs/QA/Implementation-Plan.md): PDF / Excel API RBAC.
 * Closes `FIN-API-001`, `FIN-API-002` / Threat-Model `T-FIN-06`, `T-FIN-08`.
 *
 * Where the boundary lives (read before asserting — not assumed):
 *   - `GET /api/invoices/[invoiceId]/pdf` (`app/api/invoices/.../pdf/route.ts`):
 *     session → `canAccessInvoices(role)` (owner|accountant|doctor, D53,
 *     `lib/invoices/rbac.ts`) → `.eq("clinic_id", profile.clinic_id)` →
 *     storage download. Wrong role → **403** `{ error: "forbidden" }`.
 *     Cross-clinic IDOR → **404** is already `FILE-SEC-003` in
 *     `storage-isolation.test.ts`; this file asserts the **role** gate
 *     under the FIN-API-001 catalog id (reception session → 403).
 *   - `GET /api/reports/excel` (`app/api/reports/excel/route.ts`):
 *     session → `canAccessExpenses(role)` (owner|accountant,
 *     `lib/expenses/rbac.ts`) → `clinicHasFeature(..., "expenses_reports_excel")`
 *     → workbook. Wrong role → **403** `forbidden`; feature off → **403**
 *     `feature_disabled`. Live `plan_entitlements`: starter=false,
 *     professional/premium_ai/enterprise=true (PRD §4.3 / seed).
 *
 * Pattern: **P1.2** (call route `GET` with `Request` +
 * `vi.mock("@/lib/supabase/server")` swapping only cookie-session
 * plumbing for a real signed-in Supabase client). No SA mock beyond that;
 * feature gate is exercised through the real `clinicHasFeature` path.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const PATIENT_FILES_BUCKET = "patient-files";
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc3, 0xa4,
  0xc3, 0xbc, 0xc3, 0xb6, 0x0a,
]);

let activeRouteClient: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeRouteClient,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "bs",
}));

import { GET as getInvoicePdfRoute } from "@/app/api/invoices/[invoiceId]/pdf/route";
import { GET as getExcelReportRoute } from "@/app/api/reports/excel/route";

async function createInvoiceWithPdf(
  db: DbClient,
  clinicId: string,
  patientId: string,
  issuedBy: string,
): Promise<{ id: string; pdfPath: string }> {
  const pdfPath = `${clinicId}/${patientId}/invoices/${randomTag()}.pdf`;

  const { error: uploadError } = await db.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(pdfPath, PDF_BYTES, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    throw new Error(`invoice pdf upload failed: ${uploadError.message}`);
  }

  const { data, error } = await db
    .from("invoices")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      series_year: 2026,
      series_number: Math.floor(Math.random() * 900_000) + 100_000,
      subtotal_amount: 100,
      vat_amount: 0,
      total_amount: 100,
      issued_by: issuedBy,
      pdf_storage_path: pdfPath,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "invoice insert failed");
  }

  return { id: data.id, pdfPath };
}

describeSecurity("finance PDF / Excel API RBAC (FIN-API-001/002)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let proClinicId: string;
  let proAccountant: TestUser;
  let proDoctor: TestUser;
  let proReception: TestUser;
  let invoiceId: string;

  let starterAccountant: TestUser;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const starterPlanId = await resolvePlanId(service, "starter");
    const proPlanId = await resolvePlanId(service, "professional");

    const { data: starterEnt, error: starterEntError } = await service
      .from("plan_entitlements")
      .select("enabled")
      .eq("plan_id", starterPlanId)
      .eq("feature_key", "expenses_reports_excel")
      .single();
    if (starterEntError || !starterEnt) {
      throw new Error(
        starterEntError?.message ??
          "starter plan_entitlements row for expenses_reports_excel not found",
      );
    }
    if (starterEnt.enabled) {
      throw new Error(
        "starter unexpectedly has expenses_reports_excel enabled — FIN-API-002 feature-deny premise broken; re-check PRD §4.3 / seed.sql",
      );
    }

    const { data: proEnt, error: proEntError } = await service
      .from("plan_entitlements")
      .select("enabled")
      .eq("plan_id", proPlanId)
      .eq("feature_key", "expenses_reports_excel")
      .single();
    if (proEntError || !proEnt) {
      throw new Error(
        proEntError?.message ??
          "professional plan_entitlements row for expenses_reports_excel not found",
      );
    }
    if (!proEnt.enabled) {
      throw new Error(
        "professional unexpectedly lacks expenses_reports_excel — FIN-API-002 positive-control premise broken; re-check PRD §4.3 / seed.sql",
      );
    }

    const proClinic = await createClinicWithRoles(service, {
      roles: ["accountant", "doctor", "reception"],
      clinicName: `Finance API Pro ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "fin-api",
    });
    proClinicId = proClinic.clinicId;
    proAccountant = proClinic.byRole.accountant!;
    proDoctor = proClinic.byRole.doctor!;
    proReception = proClinic.byRole.reception!;
    created.push(...proClinic.users);

    const patient = await createPatient(service, proClinicId, {
      firstName: "FinanceAPI",
      lastName: "Patient",
    });
    const invoice = await createInvoiceWithPdf(
      service,
      proClinicId,
      patient.id,
      proAccountant.userId,
    );
    invoiceId = invoice.id;

    const starterClinic = await createClinicWithRoles(service, {
      roles: ["accountant"],
      clinicName: `Finance API Starter ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "fin-api",
    });
    starterAccountant = starterClinic.byRole.accountant!;
    created.push(...starterClinic.users);
  }, 60_000);

  afterAll(async () => {
    if (!service || created.length === 0) return;
    await cleanupClinics(service, created);
  }, 60_000);

  // ---------------------------------------------------------------------
  // FIN-API-001 — PDF without finance role
  // ---------------------------------------------------------------------

  it("FIN-API-001: doctor session gets 200 PDF (D53)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      proDoctor.email,
      proDoctor.password,
    );

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceId}/pdf`),
      { params: Promise.resolve({ invoiceId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.equals(Buffer.from(PDF_BYTES))).toBe(true);
  });

  it("FIN-API-001: reception session gets 403 on invoice PDF", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      proReception.email,
      proReception.password,
    );

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceId}/pdf`),
      { params: Promise.resolve({ invoiceId }) },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
  });

  it("FIN-API-001: accountant session gets 200 PDF (positive control)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      proAccountant.email,
      proAccountant.password,
    );

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceId}/pdf`),
      { params: Promise.resolve({ invoiceId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.equals(Buffer.from(PDF_BYTES))).toBe(true);
  });

  // ---------------------------------------------------------------------
  // FIN-API-002 — Excel without feature / role
  // ---------------------------------------------------------------------

  it("FIN-API-002: reception on Pro clinic gets 403 forbidden (role gate)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      proReception.email,
      proReception.password,
    );

    const response = await getExcelReportRoute(
      new Request("http://localhost/api/reports/excel?from=2026-01-01&to=2026-12-31"),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
  });

  it("FIN-API-002: accountant on starter gets 403 feature_disabled", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      starterAccountant.email,
      starterAccountant.password,
    );

    const response = await getExcelReportRoute(
      new Request("http://localhost/api/reports/excel?from=2026-01-01&to=2026-12-31"),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("feature_disabled");
  });

  it("FIN-API-002: accountant on Pro clinic gets 200 xlsx (positive control)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      proAccountant.email,
      proAccountant.password,
    );

    const response = await getExcelReportRoute(
      new Request("http://localhost/api/reports/excel?from=2026-01-01&to=2026-12-31"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    // xlsx is a ZIP — PK magic
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer.byteLength).toBeGreaterThan(100);
  });
});
