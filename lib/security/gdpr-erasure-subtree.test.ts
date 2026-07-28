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
import {
  consentPdfPath,
  consentSignaturePath,
  documentPath,
  imagePath,
  PATIENT_FILES_BUCKET,
} from "@/lib/patients/storage";

/**
 * P2.5 (docs/QA/Implementation-Plan.md): GDPR erase full subtree + storage.
 * Closes `PII-INT-001` / Threat-Model `T-PII-02`.
 *
 * **`FILE-INT-020` ID-drift:** Threat-Model T-PII-02 and Business-Rules
 * cite `FILE-INT-020`, but Test-Strategy.md §4 has no such catalog row
 * (only `FILE-INT-001` / `FILE-INT-011`). Storage-empty assertions in this
 * file cover that threat under `PII-INT-001`; no new catalog id invented.
 *
 * Where the boundary lives (read before asserting — not assumed):
 *   - DB hard-delete: `public.approve_gdpr_patient_erasure(uuid)` in
 *     `20260714050100_phase3d_consent_draw_sign.sql` (final body; live
 *     `pg_get_functiondef` matches). SECURITY DEFINER; owner +
 *     `owner_mfa_ok()`; deletes payment plans → invoices/payments/lines →
 *     CRM/appointments/treatment/odontogram/allergies → consent_signatures →
 *     patient_documents/images → patients; audit `gdpr.patient_erased`.
 *     **Does not touch Storage.** Pattern: **P1.4** (authenticated owner
 *     JWT → RPC).
 *   - Storage cleanup: `approvePatientErasureAction`
 *     (`lib/privacy/actions.ts`) lists paths via `listPatientStoragePaths`
 *     (docs / images / invoice PDFs / consent pdf+sig), calls the RPC,
 *     then `deletePatientStorageObjects` (best-effort). Pattern: **SA**
 *     because that is where the storage boundary lives (P1.6-style mocks
 *     for Next plumbing only).
 *   - Owner approve RBAC (`PII-RLS-001`) already COVERED in
 *     `rbac-and-lifecycle.test.ts` — this file does not re-probe
 *     doctor-forbidden approve.
 *
 * Storage presence asserts use Storage **list** (not download): after a
 * successful API `remove`, download can still briefly hit blobs while the
 * `storage.objects` catalog (what GDPR cleanup updates) is already empty.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc3, 0xa4,
  0xc3, 0xbc, 0xc3, 0xb6, 0x0a,
]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);

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

// Imported after mocks (Vitest hoists `vi.mock`).
import { approvePatientErasureAction } from "@/lib/privacy/actions";

type SeededPatientFiles = {
  patientId: string;
  storagePaths: string[];
  docId: string;
  imageId: string;
  invoiceId: string;
  consentId: string;
  allergyId: string;
  toothId: string;
};

async function uploadPath(
  db: DbClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await db.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) {
    throw new Error(`storage upload ${path}: ${error.message}`);
  }
}

async function seedPatientSubtree(
  service: DbClient,
  clinicId: string,
  patientId: string,
  issuedBy: string,
): Promise<SeededPatientFiles> {
  const tag = randomTag();
  const docPath = documentPath(clinicId, patientId, `doc-${tag}`);
  const imgPath = imagePath(clinicId, patientId, `img-${tag}`);
  const invPath = `${clinicId}/${patientId}/invoices/${tag}.pdf`;
  const consentPdf = consentPdfPath(clinicId, patientId, `c-${tag}`);
  const consentSig = consentSignaturePath(clinicId, patientId, `c-${tag}`);

  await uploadPath(service, docPath, PDF_BYTES, "application/pdf");
  await uploadPath(service, imgPath, WEBP_BYTES, "image/webp");
  await uploadPath(service, invPath, PDF_BYTES, "application/pdf");
  await uploadPath(service, consentPdf, PDF_BYTES, "application/pdf");
  await uploadPath(service, consentSig, PNG_BYTES, "image/png");

  const { data: doc, error: docError } = await service
    .from("patient_documents")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      title: `Doc ${tag}`,
      storage_path: docPath,
      mime_type: "application/pdf",
      size_bytes: PDF_BYTES.length,
    })
    .select("id")
    .single();
  if (docError || !doc) throw new Error(docError?.message ?? "doc insert");

  const { data: image, error: imageError } = await service
    .from("patient_images")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      title: `Img ${tag}`,
      storage_path: imgPath,
      mime_type: "image/webp",
      size_bytes: WEBP_BYTES.length,
    })
    .select("id")
    .single();
  if (imageError || !image) {
    throw new Error(imageError?.message ?? "image insert");
  }

  const { data: invoice, error: invoiceError } = await service
    .from("invoices")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      series_year: 2026,
      series_number: Math.floor(Math.random() * 900_000) + 100_000,
      subtotal_amount: 50,
      vat_amount: 0,
      total_amount: 50,
      issued_by: issuedBy,
      pdf_storage_path: invPath,
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "invoice insert");
  }

  // Templates survive patient erase (RPC deletes signatures only). Reuse
  // the clinic's unique (clinic_id, template_key, locale) row across seeds.
  let formId: string;
  const { data: existingForm } = await service
    .from("consent_forms")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("template_key", "general_treatment")
    .eq("locale", "bs")
    .maybeSingle();
  if (existingForm?.id) {
    formId = existingForm.id;
  } else {
    const { data: form, error: formError } = await service
      .from("consent_forms")
      .insert({
        clinic_id: clinicId,
        template_key: "general_treatment",
        locale: "bs",
        title: `Form ${tag}`,
        body_text: "Consent body for GDPR erase subtree test.",
      })
      .select("id")
      .single();
    if (formError || !form) throw new Error(formError?.message ?? "form insert");
    formId = form.id;
  }

  const { data: consent, error: consentError } = await service
    .from("consent_signatures")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      consent_form_id: formId,
      template_key: "general_treatment",
      locale: "bs",
      title: `Signed ${tag}`,
      body_rendered: "Rendered consent body for GDPR erase subtree test.",
      pdf_storage_path: consentPdf,
      signature_storage_path: consentSig,
    })
    .select("id")
    .single();
  if (consentError || !consent) {
    throw new Error(consentError?.message ?? "consent insert");
  }

  const { data: allergy, error: allergyError } = await service
    .from("patient_allergies")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      allergen: `Penicillin ${tag}`,
    })
    .select("id")
    .single();
  if (allergyError || !allergy) {
    throw new Error(allergyError?.message ?? "allergy insert");
  }

  const { data: tooth, error: toothError } = await service
    .from("odontogram_teeth")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      fdi_number: 11,
    })
    .select("id")
    .single();
  if (toothError || !tooth) {
    throw new Error(toothError?.message ?? "tooth insert");
  }

  return {
    patientId,
    storagePaths: [docPath, imgPath, invPath, consentPdf, consentSig],
    docId: doc.id,
    imageId: image.id,
    invoiceId: invoice.id,
    consentId: consent.id,
    allergyId: allergy.id,
    toothId: tooth.id,
  };
}

async function storageObjectRowPresent(
  service: DbClient,
  path: string,
): Promise<boolean> {
  // Prefer list-over-download: after a Storage API remove that deletes the
  // `storage.objects` row, download can still briefly hit an orphaned blob;
  // list reflects the catalog the product/GDPR path cares about.
  const parts = path.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");
  if (!fileName) return false;
  const { data, error } = await service.storage
    .from(PATIENT_FILES_BUCKET)
    .list(folder, { limit: 100, search: fileName });
  if (error) {
    throw new Error(`storage list ${folder}: ${error.message}`);
  }
  return (data ?? []).some((obj) => obj.name === fileName);
}

describeSecurity("GDPR erase full subtree + storage (PII-INT-001)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let owner: TestUser;
  let doctor: TestUser;
  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      clinicName: `GDPR Erase ${randomTag()}`,
      roles: ["owner", "doctor"],
      emailPrefix: "gdpr-erase",
    });
    created.push(...clinic.users);
    owner = clinic.byRole.owner!;
    doctor = clinic.byRole.doctor!;
  }, 60_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  it("owner RPC hard-deletes patient subtree (docs/images/invoices/consents/allergies/odontogram) + audit", async () => {
    const patient = await createPatient(service, owner.clinicId, {
      firstName: "Subtree",
      lastName: `Rpc${randomTag().slice(-6)}`,
    });
    const seeded = await seedPatientSubtree(
      service,
      owner.clinicId,
      patient.id,
      owner.userId,
    );

    const { data: request, error: requestError } = await service
      .from("gdpr_erasure_requests")
      .insert({
        clinic_id: owner.clinicId,
        patient_id: patient.id,
        requested_by: doctor.userId,
        status: "pending",
      })
      .select("id")
      .single();
    expect(requestError).toBeNull();
    expect(request?.id).toBeTruthy();

    const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    const { data: result, error: rpcError } = await ownerClient.rpc(
      "approve_gdpr_patient_erasure",
      { p_request_id: request!.id },
    );
    expect(rpcError).toBeNull();
    expect(result).toMatchObject({
      ok: true,
      patient_id: patient.id,
      documents_deleted: 1,
      images_deleted: 1,
      invoices_deleted: 1,
      consents_deleted: 1,
    });

    const [
      patientAfter,
      docs,
      images,
      invoices,
      consents,
      allergies,
      teeth,
    ] = await Promise.all([
      service.from("patients").select("id").eq("id", patient.id).maybeSingle(),
      service
        .from("patient_documents")
        .select("id")
        .eq("id", seeded.docId)
        .maybeSingle(),
      service
        .from("patient_images")
        .select("id")
        .eq("id", seeded.imageId)
        .maybeSingle(),
      service
        .from("invoices")
        .select("id")
        .eq("id", seeded.invoiceId)
        .maybeSingle(),
      service
        .from("consent_signatures")
        .select("id")
        .eq("id", seeded.consentId)
        .maybeSingle(),
      service
        .from("patient_allergies")
        .select("id")
        .eq("id", seeded.allergyId)
        .maybeSingle(),
      service
        .from("odontogram_teeth")
        .select("id")
        .eq("id", seeded.toothId)
        .maybeSingle(),
    ]);

    expect(patientAfter.data).toBeNull();
    expect(docs.data).toBeNull();
    expect(images.data).toBeNull();
    expect(invoices.data).toBeNull();
    expect(consents.data).toBeNull();
    expect(allergies.data).toBeNull();
    expect(teeth.data).toBeNull();

    const { data: auditRows } = await service
      .from("audit_events")
      .select("payload_json")
      .eq("clinic_id", owner.clinicId)
      .eq("event_name", "gdpr.patient_erased");
    const matched = (auditRows ?? []).some((row) => {
      const payload = row.payload_json as {
        patient_id?: string;
        documents_deleted?: number;
        images_deleted?: number;
        invoices_deleted?: number;
        consents_deleted?: number;
      };
      return (
        payload.patient_id === patient.id &&
        payload.documents_deleted === 1 &&
        payload.images_deleted === 1 &&
        payload.invoices_deleted === 1 &&
        payload.consents_deleted === 1
      );
    });
    expect(matched).toBe(true);

    // RPC does not remove Storage — objects remain until SA cleanup.
    // Prove the split so the next test's SA coverage is not vacuous.
    for (const path of seeded.storagePaths) {
      expect(await storageObjectRowPresent(service, path)).toBe(true);
    }
    // Best-effort cleanup so afterAll clinic hard-delete isn't left with
    // orphaned blobs from this RPC-only probe.
    await service.storage.from(PATIENT_FILES_BUCKET).remove(seeded.storagePaths);
  }, 60_000);

  it("owner storage cleanup after RPC clears docs/images/invoices/consents (SA mirrors this)", async () => {
    const patient = await createPatient(service, owner.clinicId, {
      firstName: "Subtree",
      lastName: `Sa${randomTag().slice(-6)}`,
    });
    const control = await createPatient(service, owner.clinicId, {
      firstName: "Control",
      lastName: `Keep${randomTag().slice(-6)}`,
    });
    const seeded = await seedPatientSubtree(
      service,
      owner.clinicId,
      patient.id,
      owner.userId,
    );
    const controlPath = documentPath(
      owner.clinicId,
      control.id,
      `keep-${randomTag()}`,
    );
    await uploadPath(service, controlPath, PDF_BYTES, "application/pdf");
    const { error: controlDocError } = await service
      .from("patient_documents")
      .insert({
        clinic_id: owner.clinicId,
        patient_id: control.id,
        title: "Control keep",
        storage_path: controlPath,
        mime_type: "application/pdf",
        size_bytes: PDF_BYTES.length,
      });
    expect(controlDocError).toBeNull();

    for (const path of seeded.storagePaths) {
      expect(await storageObjectRowPresent(service, path)).toBe(true);
    }

    const { data: request, error: requestError } = await service
      .from("gdpr_erasure_requests")
      .insert({
        clinic_id: owner.clinicId,
        patient_id: patient.id,
        requested_by: doctor.userId,
        status: "pending",
      })
      .select("id")
      .single();
    expect(requestError).toBeNull();

    const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);

    // Exact SA order: list paths → RPC → storage.remove (lib/privacy/actions.ts).
    const { listPatientStoragePaths, deletePatientStorageObjects } =
      await import("@/lib/privacy/export");
    const listed = await listPatientStoragePaths(
      ownerClient,
      owner.clinicId,
      patient.id,
    );
    expect(listed.sort()).toEqual([...seeded.storagePaths].sort());

    const { error: rpcError } = await ownerClient.rpc(
      "approve_gdpr_patient_erasure",
      { p_request_id: request!.id },
    );
    expect(rpcError).toBeNull();

    const { data: removeData, error: removeError } = await ownerClient.storage
      .from(PATIENT_FILES_BUCKET)
      .remove(listed);
    expect(removeError).toBeNull();
    expect(
      (removeData ?? []).map((r) => r.name).sort(),
      `authenticated storage.remove silent no-op after GDPR RPC; data=${JSON.stringify(removeData)}`,
    ).toEqual([...listed].sort());

    // Also exercise the shared helper the SA calls.
    await deletePatientStorageObjects(ownerClient, listed);

    for (const path of seeded.storagePaths) {
      expect(await storageObjectRowPresent(service, path)).toBe(false);
    }
    expect(await storageObjectRowPresent(service, controlPath)).toBe(true);

    // Full SA path (same mocks as P1.6) — storage boundary lives in the action.
    const patient2 = await createPatient(service, owner.clinicId, {
      firstName: "Subtree",
      lastName: `FullSa${randomTag().slice(-6)}`,
    });
    const seeded2 = await seedPatientSubtree(
      service,
      owner.clinicId,
      patient2.id,
      owner.userId,
    );
    const { data: request2, error: request2Error } = await service
      .from("gdpr_erasure_requests")
      .insert({
        clinic_id: owner.clinicId,
        patient_id: patient2.id,
        requested_by: doctor.userId,
        status: "pending",
      })
      .select("id")
      .single();
    expect(request2Error).toBeNull();

    activeActionClient = await signInAs(
      url,
      anonKey,
      owner.email,
      owner.password,
    );
    const state = await approvePatientErasureAction(request2!.id);
    expect(state?.error).toBeUndefined();
    expect(state?.message).toBe("erasureCompleted");

    const remaining: string[] = [];
    for (const path of seeded2.storagePaths) {
      if (await storageObjectRowPresent(service, path)) remaining.push(path);
    }
    expect(
      remaining,
      "SA returned erasureCompleted but patient-files still present (best-effort catch hid remove failure)",
    ).toEqual([]);
  }, 90_000);
});
