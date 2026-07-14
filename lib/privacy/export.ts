import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { PATIENT_FILES_BUCKET } from "@/lib/patients/storage";

type Client = SupabaseClient<Database>;

export type PatientExportPayload = {
  exported_at: string;
  clinic_id: string;
  patient: Record<string, Json | undefined> | null;
  allergies: Json[];
  documents: Json[];
  images: Json[];
  odontogram_teeth: Json[];
  odontogram_events: Json[];
  treatment_plans: Json[];
  treatment_plan_items: Json[];
  appointments: Json[];
  waitlist: Json[];
  invoices: Json[];
  invoice_lines: Json[];
  payments: Json[];
  payment_plans: Json[];
  payment_plan_installments: Json[];
};

export async function buildPatientExport(
  supabase: Client,
  clinicId: string,
  patientId: string,
): Promise<PatientExportPayload | null> {
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return null;

  const [
    allergies,
    documents,
    images,
    teeth,
    odontogramEvents,
    plans,
    appointments,
    waitlist,
    invoices,
    paymentPlans,
  ] = await Promise.all([
    supabase
      .from("patient_allergies")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("patient_documents")
      .select("id, title, storage_path, size_bytes, mime_type, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("patient_images")
      .select("id, title, storage_path, size_bytes, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("odontogram_teeth")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("odontogram_events")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("treatment_plans")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("appointments")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("appointment_waitlist")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("invoices")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("payment_plans")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
  ]);

  const planIds = (plans.data ?? []).map((p) => p.id);
  const invoiceIds = (invoices.data ?? []).map((i) => i.id);
  const paymentPlanIds = (paymentPlans.data ?? []).map((p) => p.id);

  const [items, lines, payments, installments] = await Promise.all([
    planIds.length
      ? supabase.from("treatment_plan_items").select("*").in("treatment_plan_id", planIds)
      : Promise.resolve({ data: [] as Json[] }),
    invoiceIds.length
      ? supabase.from("invoice_lines").select("*").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as Json[] }),
    invoiceIds.length
      ? supabase.from("payments").select("*").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as Json[] }),
    paymentPlanIds.length
      ? supabase
          .from("payment_plan_installments")
          .select("*")
          .in("payment_plan_id", paymentPlanIds)
      : Promise.resolve({ data: [] as Json[] }),
  ]);

  return {
    exported_at: new Date().toISOString(),
    clinic_id: clinicId,
    patient: patient as unknown as Record<string, Json | undefined>,
    allergies: (allergies.data ?? []) as Json[],
    documents: (documents.data ?? []) as Json[],
    images: (images.data ?? []) as Json[],
    odontogram_teeth: (teeth.data ?? []) as Json[],
    odontogram_events: (odontogramEvents.data ?? []) as Json[],
    treatment_plans: (plans.data ?? []) as Json[],
    treatment_plan_items: (items.data ?? []) as Json[],
    appointments: (appointments.data ?? []) as Json[],
    waitlist: (waitlist.data ?? []) as Json[],
    invoices: (invoices.data ?? []) as Json[],
    invoice_lines: (lines.data ?? []) as Json[],
    payments: (payments.data ?? []) as Json[],
    payment_plans: (paymentPlans.data ?? []) as Json[],
    payment_plan_installments: (installments.data ?? []) as Json[],
  };
}

/** Collect storage paths for a patient before hard delete. */
export async function listPatientStoragePaths(
  supabase: Client,
  clinicId: string,
  patientId: string,
): Promise<string[]> {
  const [{ data: docs }, { data: images }, { data: invoices }] =
    await Promise.all([
      supabase
        .from("patient_documents")
        .select("storage_path")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId),
      supabase
        .from("patient_images")
        .select("storage_path")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId),
      supabase
        .from("invoices")
        .select("pdf_storage_path")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId),
    ]);

  const paths = [
    ...(docs ?? []).map((d) => d.storage_path),
    ...(images ?? []).map((i) => i.storage_path),
    ...(invoices ?? [])
      .map((i) => i.pdf_storage_path)
      .filter((p): p is string => Boolean(p)),
  ];

  return [...new Set(paths)];
}

export async function deletePatientStorageObjects(
  supabase: Client,
  paths: string[],
) {
  if (paths.length === 0) return;
  // Chunk to stay under API limits
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage
      .from(PATIENT_FILES_BUCKET)
      .remove(chunk);
    if (error) {
      throw error;
    }
  }
}
