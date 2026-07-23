import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P1.2 (docs/QA/Implementation-Plan.md): storage RLS for branding / consent /
 * invoice paths + the invoice PDF download API. Closes:
 *   FILE-RLS-002 — upload to another clinic's storage folder (WITH CHECK)
 *   FILE-SEC-001 — no bucket is publicly listable, including to anon
 *   FILE-SEC-003 — invoice PDF API route rejects cross-clinic invoice ids
 *
 * Threat-Model T-TEN-04 / T-FILE-01 / T-FILE-02 / T-FIN-06 are the abuse
 * cases this file targets.
 *
 * Bucket + path inventory (read from migrations, not assumed):
 *   - `clinic-branding` (20260713270000_phase2g_branding.sql): private
 *     (`public = false`), path `{clinic_id}/logo.webp`, INSERT/UPDATE/DELETE
 *     require `is_clinic_owner()`, SELECT any authenticated clinic member.
 *   - `patient-files` (20260713210000_phase2a_clinical_core.sql): private
 *     (`public = false`), generic path
 *     `{clinic_id}/{patient_id}/documents|images|consents/...` gated by
 *     `can_access_patients()` / `can_write_patients()` (owner/doctor/
 *     assistant/reception) — consent signature/PDF paths
 *     (`lib/patients/storage.ts` `consentPdfPath`/`consentSignaturePath`)
 *     land under this generic `consents/` subfolder; there is no
 *     consent-specific storage policy, so testing the PDF path also proves
 *     the sibling `.sig.png` path (same `foldername[1]` gate, no per-
 *     extension distinction in the policy).
 *   - `patient-files` invoice-scoped policies
 *     (20260713240000_phase2d_invoices.sql, `foldername[3] = 'invoices'`):
 *     gated by `can_access_invoices()` / `can_write_invoices()`
 *     (owner/accountant only).
 *   - Both buckets are the *only* two buckets in this schema (grepped every
 *     `insert into storage.buckets` across `supabase/migrations/**`) and
 *     both are private — there is no bucket that is intentionally public by
 *     design (e.g. for a marketing-site logo), so FILE-SEC-001 below does
 *     not need to special-case a "public bucket" exception.
 *
 * FILE-RLS-002 pattern mirrors tenant-isolation.test.ts's storage test:
 * clinic B objects are created directly via the service-role client, then a
 * signed-in Clinic A user (using a role that legitimately has *some* write
 * access to that folder type, so a denial can only be explained by the
 * `{clinic_id}/...` folder check, not an unrelated RBAC gap) attempts to
 * upload into / list / download from Clinic B's folder and must be denied.
 *
 * FILE-SEC-003 harness note: `app/api/invoices/[invoiceId]/pdf/route.ts`
 * resolves its Supabase client via `@/lib/supabase/server`, which reads
 * `next/headers` cookies — that only works inside a real Next.js request
 * context, not a bare Vitest import. We replace *only* that one module
 * with a lazy accessor to an already-authenticated (or anonymous) Supabase
 * client obtained the same way every other test in this suite gets one
 * (`signInAs` / `createSupabaseClient` against the real local Supabase
 * Auth). The route's own auth/ownership/RBAC logic, and the real RLS +
 * Storage behind it, are untouched — only the Next.js cookie plumbing is
 * substituted.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const CLINIC_BRANDING_BUCKET = "clinic-branding";
const PATIENT_FILES_BUCKET = "patient-files";

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc3, 0xa4,
  0xc3, 0xbc, 0xc3, 0xb6, 0x0a,
]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

let activeRouteClient: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeRouteClient,
}));

// Textually after the `vi.mock` above on purpose (Vitest hoists `vi.mock`
// calls above all imports regardless of source position, but keeping this
// import below it documents the dependency for human readers).
import { GET as getInvoicePdfRoute } from "@/app/api/invoices/[invoiceId]/pdf/route";

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

describeSecurity("storage isolation & invoice PDF API (release blocker)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  // Clinic A: one signed-in user per role needed to legitimately write each
  // folder type under test (owner→branding, doctor→consents, accountant→
  // invoices), so a denial can only be explained by cross-tenant isolation.
  let clinicA: { clinicId: string; owner: TestUser; doctor: TestUser; accountant: TestUser };
  // Clinic B: service-role only (never signed in) — the target tenant whose
  // objects Clinic A must never reach.
  let clinicB: { clinicId: string; owner: TestUser };

  const created: TestUser[] = [];

  let patientA: { id: string };
  let patientB: { id: string };
  let invoiceA: { id: string; pdfPath: string };
  let invoiceB: { id: string; pdfPath: string };

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const a = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "accountant"],
      clinicName: `Storage A ${randomTag()}`,
      emailPrefix: "file-a",
    });
    clinicA = {
      clinicId: a.clinicId,
      owner: a.byRole.owner!,
      doctor: a.byRole.doctor!,
      accountant: a.byRole.accountant!,
    };
    created.push(...a.users);

    const b = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `Storage B ${randomTag()}`,
      emailPrefix: "file-b",
    });
    clinicB = { clinicId: b.clinicId, owner: b.byRole.owner! };
    created.push(...b.users);

    patientA = await createPatient(service, clinicA.clinicId, {
      firstName: "Storage",
      lastName: "PatientA",
    });
    patientB = await createPatient(service, clinicB.clinicId, {
      firstName: "Storage",
      lastName: "PatientB",
    });

    invoiceA = await createInvoiceWithPdf(
      service,
      clinicA.clinicId,
      patientA.id,
      clinicA.accountant.userId,
    );
    invoiceB = await createInvoiceWithPdf(
      service,
      clinicB.clinicId,
      patientB.id,
      clinicB.owner.userId,
    );
  }, 60_000);

  afterAll(async () => {
    // hard_delete_clinic() (phase3c_clinic_lifecycle.sql) deletes every
    // storage.objects row under `{clinic_id}/...` across every bucket, so
    // no separate storage cleanup is needed for the branding/patient-files
    // objects uploaded below.
    await cleanupClinics(service, created);
  }, 60_000);

  // ---------------------------------------------------------------------
  // FILE-RLS-002 — branding folder
  // ---------------------------------------------------------------------

  it("FILE-RLS-002: clinic A owner cannot upload into clinic B's branding folder", async () => {
    const client = await signInAs(url, anonKey, clinicA.owner.email, clinicA.owner.password);

    const { error } = await client.storage
      .from(CLINIC_BRANDING_BUCKET)
      .upload(`${clinicB.clinicId}/logo.webp`, WEBP_BYTES, {
        contentType: "image/webp",
        upsert: true,
      });

    expect(error).not.toBeNull();
  });

  it("FILE-RLS-002: clinic A cannot list or download clinic B's branding logo", async () => {
    const path = `${clinicB.clinicId}/logo.webp`;
    const { error: uploadError } = await service.storage
      .from(CLINIC_BRANDING_BUCKET)
      .upload(path, WEBP_BYTES, { contentType: "image/webp", upsert: true });
    expect(uploadError).toBeNull();

    const client = await signInAs(url, anonKey, clinicA.owner.email, clinicA.owner.password);

    const { data: downloaded, error: downloadError } = await client.storage
      .from(CLINIC_BRANDING_BUCKET)
      .download(path);
    expect(downloaded).toBeNull();
    expect(downloadError).not.toBeNull();

    const { data: listed } = await client.storage
      .from(CLINIC_BRANDING_BUCKET)
      .list(clinicB.clinicId, { limit: 10 });
    expect(listed ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // FILE-RLS-002 — consent signature/PDF folder (generic patient-files gate)
  // ---------------------------------------------------------------------

  it("FILE-RLS-002: clinic A doctor cannot upload into clinic B's consent folder", async () => {
    const client = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);

    const { error } = await client.storage
      .from(PATIENT_FILES_BUCKET)
      .upload(`${clinicB.clinicId}/${patientB.id}/consents/${randomTag()}.pdf`, PDF_BYTES, {
        contentType: "application/pdf",
        upsert: true,
      });

    expect(error).not.toBeNull();
  });

  it("FILE-RLS-002: clinic A cannot list or download clinic B's consent PDF", async () => {
    const path = `${clinicB.clinicId}/${patientB.id}/consents/${randomTag()}.pdf`;
    const { error: uploadError } = await service.storage
      .from(PATIENT_FILES_BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf", upsert: true });
    expect(uploadError).toBeNull();

    const client = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);

    const { data: downloaded, error: downloadError } = await client.storage
      .from(PATIENT_FILES_BUCKET)
      .download(path);
    expect(downloaded).toBeNull();
    expect(downloadError).not.toBeNull();

    const { data: listed } = await client.storage
      .from(PATIENT_FILES_BUCKET)
      .list(`${clinicB.clinicId}/${patientB.id}/consents`, { limit: 10 });
    expect(listed ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // FILE-RLS-002 — invoice PDF folder (foldername[3] = 'invoices' gate)
  // ---------------------------------------------------------------------

  it("FILE-RLS-002: clinic A accountant cannot upload into clinic B's invoice folder", async () => {
    const client = await signInAs(
      url,
      anonKey,
      clinicA.accountant.email,
      clinicA.accountant.password,
    );

    const { error } = await client.storage
      .from(PATIENT_FILES_BUCKET)
      .upload(`${clinicB.clinicId}/${patientB.id}/invoices/${randomTag()}.pdf`, PDF_BYTES, {
        contentType: "application/pdf",
        upsert: true,
      });

    expect(error).not.toBeNull();
  });

  it("FILE-RLS-002: clinic A cannot list or download clinic B's invoice PDF", async () => {
    // Reuses invoiceB's real PDF path — the same object the invoice PDF API
    // route would serve, proving the storage-level gate matches FILE-SEC-003.
    const client = await signInAs(
      url,
      anonKey,
      clinicA.accountant.email,
      clinicA.accountant.password,
    );

    const { data: downloaded, error: downloadError } = await client.storage
      .from(PATIENT_FILES_BUCKET)
      .download(invoiceB.pdfPath);
    expect(downloaded).toBeNull();
    expect(downloadError).not.toBeNull();

    const { data: listed } = await client.storage
      .from(PATIENT_FILES_BUCKET)
      .list(`${clinicB.clinicId}/${patientB.id}/invoices`, { limit: 10 });
    expect(listed ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // FILE-SEC-001 — no bucket is publicly listable/downloadable to anon
  // ---------------------------------------------------------------------

  it("FILE-SEC-001: anon (no session) cannot list clinic-branding or patient-files, root or nested", async () => {
    const anon = createSupabaseClient(url, anonKey);

    const brandingRoot = await anon.storage.from(CLINIC_BRANDING_BUCKET).list("", { limit: 10 });
    expect(brandingRoot.data ?? []).toHaveLength(0);

    const brandingClinicB = await anon.storage
      .from(CLINIC_BRANDING_BUCKET)
      .list(clinicB.clinicId, { limit: 10 });
    expect(brandingClinicB.data ?? []).toHaveLength(0);

    const filesRoot = await anon.storage.from(PATIENT_FILES_BUCKET).list("", { limit: 10 });
    expect(filesRoot.data ?? []).toHaveLength(0);

    const filesClinicB = await anon.storage
      .from(PATIENT_FILES_BUCKET)
      .list(clinicB.clinicId, { limit: 10 });
    expect(filesClinicB.data ?? []).toHaveLength(0);
  });

  it("FILE-SEC-001: anon (no session) cannot download a known object by exact path", async () => {
    const anon = createSupabaseClient(url, anonKey);

    const { data: brandingFile, error: brandingError } = await anon.storage
      .from(CLINIC_BRANDING_BUCKET)
      .download(`${clinicB.clinicId}/logo.webp`);
    expect(brandingFile).toBeNull();
    expect(brandingError).not.toBeNull();

    const { data: invoiceFile, error: invoiceError } = await anon.storage
      .from(PATIENT_FILES_BUCKET)
      .download(invoiceB.pdfPath);
    expect(invoiceFile).toBeNull();
    expect(invoiceError).not.toBeNull();
  });

  // ---------------------------------------------------------------------
  // FILE-SEC-003 — invoice PDF API route: IDOR / RBAC / auth
  // ---------------------------------------------------------------------

  it("FILE-SEC-003: returns 404 for clinic B's invoice id under a clinic A session (no cross-clinic leak)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      clinicA.accountant.email,
      clinicA.accountant.password,
    );

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceB.id}/pdf`),
      { params: Promise.resolve({ invoiceId: invoiceB.id }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("not_found");
  });

  it("FILE-SEC-003: returns 200 with the correct PDF for clinic A's own invoice (positive control)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      clinicA.accountant.email,
      clinicA.accountant.password,
    );

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceA.id}/pdf`),
      { params: Promise.resolve({ invoiceId: invoiceA.id }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.equals(Buffer.from(PDF_BYTES))).toBe(true);
  });

  it("FILE-SEC-003: returns 403 for a role without invoice access (owner+accountant only)", async () => {
    activeRouteClient = await signInAs(url, anonKey, clinicA.doctor.email, clinicA.doctor.password);

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceA.id}/pdf`),
      { params: Promise.resolve({ invoiceId: invoiceA.id }) },
    );

    expect(response.status).toBe(403);
  });

  it("FILE-SEC-003: returns 401 with no session", async () => {
    activeRouteClient = createSupabaseClient(url, anonKey);

    const response = await getInvoicePdfRoute(
      new Request(`http://localhost/api/invoices/${invoiceA.id}/pdf`),
      { params: Promise.resolve({ invoiceId: invoiceA.id }) },
    );

    expect(response.status).toBe(401);
  });
});
