import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createServiceRow,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";
import {
  consentPdfPath,
  consentSignaturePath,
  PATIENT_FILES_BUCKET,
} from "@/lib/patients/storage";

/**
 * P4.5 (docs/QA/Implementation-Plan.md): patient chart clinical INT —
 * odontogram FDI, treatment plan item statuses, consent draw-sign storage.
 * Closes `PII-INT-010`, `PII-INT-011`, `PII-INT-012` / D18 / D19 / D20.
 *
 * **Mechanism (grepped, not assumed):**
 * - FDI: DB `public.is_valid_fdi` + CHECK on `odontogram_teeth` /
 *   `odontogram_events` / `treatment_plan_items` (`phase2a`/`phase2b`).
 *   SA `upsertToothStatusAction` also gates via Zod + `isValidFdi`
 *   (`lib/odontogram/fdi.ts`) before upsert.
 * - Plan item status: Postgres enum `treatment_plan_item_status`
 *   (planned/in_progress/done/cancelled) + Zod
 *   `updateTreatmentPlanItemStatusSchema` / `addTreatmentPlanItemSchema`.
 *   **Not** visit→item closure (Discrepancies **D-11** — product still open;
 *   extend this ID when that lands).
 * - Consent draw-sign: `signConsentAction` renders PDF, uploads PNG sig +
 *   PDF under `{clinic}/{patient}/consents/{id}.sig.png` + `.pdf`, inserts
 *   `consent_signatures` with both paths. Feature `consent_draw_sign` (Pro+).
 *
 * **`FILE-INT-010` ID-drift:** Traceability cites it with D20, but
 * Test-Strategy has no catalog row — storage presence asserts live under
 * `PII-INT-012` (same pattern as `FILE-INT-020` / P2.5).
 *
 * Pattern: P1.6 SA (`vi.mock` Next + real actions) + P1.4 DB checks.
 * Actor = doctor (odontogram/plan write + consent sign; sidesteps owner MFA).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

/** 1×1 PNG — ≥64 bytes + magic so `parsePngDataUrl` accepts it. */
const MIN_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SIGNATURE_DATA_URL = `data:image/png;base64,${MIN_PNG_B64}`;

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

import { upsertToothStatusAction } from "@/lib/odontogram/actions";
import {
  addTreatmentPlanItemAction,
  createTreatmentPlanAction,
  updateTreatmentPlanItemStatusAction,
} from "@/lib/treatment-plans/actions";
import { signConsentAction } from "@/lib/consent/actions";

describeSecurity("P4.5 patient chart clinical (PII-INT-010..012)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicId: string;
  let doctor: TestUser;
  let doctorClient: DbClient;
  let patientId: string;
  let serviceId: string;
  let consentFormId: string;
  const created: TestUser[] = [];
  const storageToClean: string[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor"],
      clinicName: `PII-INT-010 Chart ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "pii-int-010",
    });
    clinicId = clinic.clinicId;
    created.push(...clinic.users);
    doctor = clinic.byRole.doctor!;

    doctorClient = await signInAs(
      url,
      anonKey,
      doctor.email,
      doctor.password,
    );

    const patient = await createPatient(service, clinicId, {
      firstName: "Chart",
      lastName: `P${randomTag().slice(-6)}`,
    });
    patientId = patient.id;

    const svc = await createServiceRow(service, clinicId);
    serviceId = svc.id;

    const { data: form, error: formError } = await service
      .from("consent_forms")
      .insert({
        clinic_id: clinicId,
        template_key: "general_treatment",
        locale: "bs",
        title: "Test saglasnost {{ime}}",
        body_text: "Pacijent {{ime}} u {{ordinacija}} dana {{datum}}.",
      })
      .select("id")
      .single();
    if (formError || !form) {
      throw new Error(formError?.message ?? "consent form insert failed");
    }
    consentFormId = form.id;
  }, 120_000);

  afterAll(async () => {
    if (service && storageToClean.length > 0) {
      await service.storage
        .from(PATIENT_FILES_BUCKET)
        .remove(storageToClean)
        .catch(() => undefined);
    }
    if (service && created.length > 0) {
      await cleanupClinics(service, created);
    }
  }, 120_000);

  it("PII-INT-010: FDI 99 rejected by SA + DB CHECK; valid 11 upserts", async () => {
    activeActionClient = doctorClient;

    const badFd = new FormData();
    badFd.set("fdiNumber", "99");
    badFd.set("status", "caries");
    badFd.set("note", "");
    const bad = await upsertToothStatusAction(patientId, null, badFd);
    expect(bad?.error).toBe("invalid");

    const { count: afterBad } = await service
      .from("odontogram_teeth")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("fdi_number", 99);
    expect(afterBad ?? 0).toBe(0);

    const direct = await doctorClient.from("odontogram_teeth").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      fdi_number: 99,
      status: "caries",
      updated_by: doctor.userId,
    });
    expect(direct.error).toBeTruthy();
    expect(direct.error?.message ?? "").toMatch(/fdi|check|violat/i);

    const goodFd = new FormData();
    goodFd.set("fdiNumber", "11");
    goodFd.set("status", "filled");
    goodFd.set("note", "PII-INT-010");
    const good = await upsertToothStatusAction(patientId, null, goodFd);
    expect(good?.message).toBe("toothUpdated");

    const { data: tooth } = await service
      .from("odontogram_teeth")
      .select("fdi_number, status")
      .eq("patient_id", patientId)
      .eq("fdi_number", 11)
      .single();
    expect(tooth?.status).toBe("filled");
  });

  it("PII-INT-011: item status enum enforced (SA + DB); valid transitions work", async () => {
    activeActionClient = doctorClient;

    const createFd = new FormData();
    createFd.set("title", `Plan ${randomTag().slice(-6)}`);
    createFd.set("notes", "");
    const createdPlan = await createTreatmentPlanAction(
      patientId,
      null,
      createFd,
    );
    expect(createdPlan?.message).toBe("planCreated");

    const { data: plan } = await service
      .from("treatment_plans")
      .select("id")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(plan?.id).toBeTruthy();

    const addFd = new FormData();
    addFd.set("serviceId", serviceId);
    addFd.set("fdiNumber", "21");
    addFd.set("estimatedPriceEur", "50");
    addFd.set("notes", "");
    addFd.set("status", "planned");
    const added = await addTreatmentPlanItemAction(
      patientId,
      plan!.id,
      null,
      addFd,
    );
    expect(added?.message).toBe("itemAdded");

    const { data: item } = await service
      .from("treatment_plan_items")
      .select("id, status")
      .eq("treatment_plan_id", plan!.id)
      .single();
    expect(item?.status).toBe("planned");

    const badStatus = await updateTreatmentPlanItemStatusAction(
      patientId,
      item!.id,
      "bogus_status",
    );
    expect(badStatus?.error).toBe("invalid");

    const { data: stillPlanned } = await service
      .from("treatment_plan_items")
      .select("status")
      .eq("id", item!.id)
      .single();
    expect(stillPlanned?.status).toBe("planned");

    const badAdd = new FormData();
    badAdd.set("serviceId", serviceId);
    badAdd.set("fdiNumber", "");
    badAdd.set("estimatedPriceEur", "10");
    badAdd.set("notes", "");
    badAdd.set("status", "not_a_status");
    const badAddResult = await addTreatmentPlanItemAction(
      patientId,
      plan!.id,
      null,
      badAdd,
    );
    expect(badAddResult?.error).toBe("invalid");

    for (const status of ["in_progress", "done", "cancelled"] as const) {
      const result = await updateTreatmentPlanItemStatusAction(
        patientId,
        item!.id,
        status,
      );
      expect(result?.message).toBe("itemUpdated");
      const { data: row } = await service
        .from("treatment_plan_items")
        .select("status")
        .eq("id", item!.id)
        .single();
      expect(row?.status).toBe(status);
    }

    // DB residual: enum rejects unknown label even if SA bypassed.
    const { error: enumError } = await doctorClient
      .from("treatment_plan_items")
      .update({
        // @ts-expect-error intentional invalid enum for probe
        status: "bogus_status",
      })
      .eq("id", item!.id);
    expect(enumError).toBeTruthy();
  }, 60_000);

  it("PII-INT-012: signConsentAction stores PDF + PNG under consents/ paths", async () => {
    activeActionClient = doctorClient;

    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("consentFormId", consentFormId);
    fd.set("signatureDataUrl", SIGNATURE_DATA_URL);

    const result = await signConsentAction(null, fd);
    expect(result?.message).toBe("signed");

    const { data: row, error } = await service
      .from("consent_signatures")
      .select("id, pdf_storage_path, signature_storage_path")
      .eq("patient_id", patientId)
      .eq("consent_form_id", consentFormId)
      .order("signed_at", { ascending: false })
      .limit(1)
      .single();
    expect(error).toBeNull();
    expect(row?.id).toBeTruthy();

    const expectedPdf = consentPdfPath(clinicId, patientId, row!.id);
    const expectedSig = consentSignaturePath(clinicId, patientId, row!.id);
    expect(row!.pdf_storage_path).toBe(expectedPdf);
    expect(row!.signature_storage_path).toBe(expectedSig);
    storageToClean.push(expectedPdf, expectedSig);

    const prefix = `${clinicId}/${patientId}/consents`;
    const listed = await service.storage
      .from(PATIENT_FILES_BUCKET)
      .list(prefix, { limit: 50 });
    expect(listed.error).toBeNull();
    const names = (listed.data ?? []).map((o) => o.name);
    expect(names).toContain(`${row!.id}.pdf`);
    expect(names).toContain(`${row!.id}.sig.png`);

    const pdfDl = await service.storage
      .from(PATIENT_FILES_BUCKET)
      .download(expectedPdf);
    expect(pdfDl.error).toBeNull();
    const pdfBuf = Buffer.from(await pdfDl.data!.arrayBuffer());
    expect(pdfBuf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfBuf.byteLength).toBeGreaterThan(100);

    const sigDl = await service.storage
      .from(PATIENT_FILES_BUCKET)
      .download(expectedSig);
    expect(sigDl.error).toBeNull();
    const sigBuf = Buffer.from(await sigDl.data!.arrayBuffer());
    expect(sigBuf[0]).toBe(0x89);
    expect(sigBuf[1]).toBe(0x50);
  }, 60_000);
});
