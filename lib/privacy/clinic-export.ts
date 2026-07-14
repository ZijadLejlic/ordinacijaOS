import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const PAGE_SIZE = 1000;

export type ClinicExportManifest = {
  exported_at: string;
  clinic_id: string;
  clinic_name: string | null;
  scope: "clinic_backup_v1";
  /** Distinct from single-patient GDPR JSON (PRD §8.2 vs §8.3). */
  includes: string[];
  excludes: string[];
  counts: {
    patients: number;
    invoices: number;
    invoice_lines: number;
    payments: number;
    documents_meta: number;
    images_meta: number;
  };
};

async function fetchAllByClinic<T extends Record<string, unknown>>(
  supabase: Client,
  table:
    | "patients"
    | "invoices"
    | "invoice_lines"
    | "payments"
    | "patient_documents"
    | "patient_images",
  clinicId: string,
  select: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const chunk = (data ?? []) as unknown as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * Clinic on-demand ZIP backup (PRD §8.3 / D45): patients, invoices (+ lines/payments),
 * document & image metadata — not full clinical chart / binary files.
 */
export async function buildClinicExportZip(
  supabase: Client,
  clinicId: string,
): Promise<{ buffer: Buffer; filename: string; manifest: ClinicExportManifest }> {
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("id", clinicId)
    .maybeSingle();

  if (clinicError) throw clinicError;
  if (!clinic) {
    throw new Error("clinic_not_found");
  }

  const [
    patients,
    invoices,
    invoiceLines,
    payments,
    documents,
    images,
  ] = await Promise.all([
    fetchAllByClinic(supabase, "patients", clinicId, "*"),
    fetchAllByClinic(supabase, "invoices", clinicId, "*"),
    fetchAllByClinic(supabase, "invoice_lines", clinicId, "*"),
    fetchAllByClinic(supabase, "payments", clinicId, "*"),
    fetchAllByClinic(
      supabase,
      "patient_documents",
      clinicId,
      "id, patient_id, title, storage_path, size_bytes, mime_type, uploaded_by, created_at",
    ),
    fetchAllByClinic(
      supabase,
      "patient_images",
      clinicId,
      "id, patient_id, title, storage_path, size_bytes, mime_type, uploaded_by, created_at",
    ),
  ]);

  const exportedAt = new Date().toISOString();
  const dateStamp = exportedAt.slice(0, 10);

  const manifest: ClinicExportManifest = {
    exported_at: exportedAt,
    clinic_id: clinicId,
    clinic_name: clinic.name,
    scope: "clinic_backup_v1",
    includes: [
      "patients",
      "invoices",
      "invoice_lines",
      "payments",
      "documents_meta",
      "images_meta",
    ],
    excludes: [
      "odontogram",
      "treatment_plans",
      "appointments",
      "allergies",
      "binary_storage_files",
      "single_patient_gdpr_json_scope",
    ],
    counts: {
      patients: patients.length,
      invoices: invoices.length,
      invoice_lines: invoiceLines.length,
      payments: payments.length,
      documents_meta: documents.length,
      images_meta: images.length,
    },
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "README.txt",
    [
      "DentOrd clinic backup (ZIP)",
      `Clinic: ${clinic.name ?? clinicId}`,
      `Exported at: ${exportedAt}`,
      "",
      "Contents (PRD §8.3):",
      "- patients.json",
      "- invoices.json, invoice_lines.json, payments.json",
      "- documents_meta.json, images_meta.json (metadata only — no binary files)",
      "",
      "This is NOT the same scope as single-patient GDPR JSON export.",
      "Account closure (D45): export → 7-day grace → hard delete (platform job later).",
      "",
    ].join("\n"),
  );
  zip.file("patients.json", JSON.stringify(patients, null, 2));
  zip.file("invoices.json", JSON.stringify(invoices, null, 2));
  zip.file("invoice_lines.json", JSON.stringify(invoiceLines, null, 2));
  zip.file("payments.json", JSON.stringify(payments, null, 2));
  zip.file("documents_meta.json", JSON.stringify(documents, null, 2));
  zip.file("images_meta.json", JSON.stringify(images, null, 2));

  const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
  const safeName = (clinic.name ?? "clinic")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = `dentord-${safeName || "clinic"}-backup-${dateStamp}.zip`;

  return { buffer, filename, manifest };
}
