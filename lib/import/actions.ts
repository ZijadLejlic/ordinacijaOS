"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { assertFeature } from "@/lib/entitlements";
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  parseCsv,
} from "@/lib/import/csv";
import {
  hasPatientHeaders,
  mapPatientCsvRow,
  type PatientImportRow,
} from "@/lib/import/patients-map";
import {
  canImportPatients,
  canImportServices,
} from "@/lib/import/rbac";
import {
  hasServiceHeaders,
  mapServiceCsvRow,
  type ServiceImportRow,
} from "@/lib/import/services-map";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type ImportKind = "patients" | "services";
export type ImportMode = "preview" | "commit";

export type ImportRowError = {
  rowNumber: number;
  message: string;
};

export type ImportActionState = {
  error?: string;
  message?: string;
  kind?: ImportKind;
  mode?: ImportMode;
  totalCount?: number;
  validCount?: number;
  errorCount?: number;
  importedCount?: number;
  rowErrors?: ImportRowError[];
  /** First few valid rows for UI preview (no PII beyond what's imported). */
  sample?: Array<Record<string, string | number | null>>;
} | null;

async function requireImportProfile(allowedRoles: readonly AppRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !allowedRoles.includes(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile };
}

async function readCsvFile(formData: FormData): Promise<
  | { ok: true; text: string }
  | { ok: false; error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "invalid" };
  }
  if (file.size === 0) {
    return { ok: false, error: "emptyFile" };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { ok: false, error: "fileTooLarge" };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && file.type && !file.type.includes("csv") && file.type !== "text/plain") {
    // Allow text/plain / empty mime; reject obvious non-csv
    if (file.type.startsWith("image/") || file.type.includes("pdf")) {
      return { ok: false, error: "invalidFileType" };
    }
  }
  const text = await file.text();
  return { ok: true, text };
}

function parsePatients(rows: Record<string, string>[]) {
  const valid: PatientImportRow[] = [];
  const rowErrors: ImportRowError[] = [];
  rows.forEach((row, index) => {
    const result = mapPatientCsvRow(row, index + 2); // +2: header is row 1
    if (result.ok) valid.push(result.data);
    else rowErrors.push({ rowNumber: result.rowNumber, message: result.message });
  });
  return { valid, rowErrors };
}

function parseServices(rows: Record<string, string>[]) {
  const valid: ServiceImportRow[] = [];
  const rowErrors: ImportRowError[] = [];
  rows.forEach((row, index) => {
    const result = mapServiceCsvRow(row, index + 2);
    if (result.ok) valid.push(result.data);
    else rowErrors.push({ rowNumber: result.rowNumber, message: result.message });
  });
  return { valid, rowErrors };
}

function patientSample(rows: PatientImportRow[]) {
  return rows.slice(0, 5).map((r) => ({
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    email: r.email,
    dateOfBirth: r.dateOfBirth,
  }));
}

function serviceSample(rows: ServiceImportRow[]) {
  return rows.slice(0, 5).map((r) => ({
    name: r.name,
    code: r.code,
    durationMinutes: r.durationMinutes,
    priceEur: r.priceEur,
    vatRate: r.vatRate,
  }));
}

const INSERT_CHUNK = 100;

export async function importPatientsAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const mode: ImportMode =
    formData.get("mode") === "commit" ? "commit" : "preview";
  const auth = await requireImportProfile(["owner"]);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden", kind: "patients", mode };
  }
  if (!canImportPatients(auth.profile.role)) {
    return { error: "forbidden", kind: "patients", mode };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "patients_chart",
  );
  if (!feature.ok) {
    return { error: feature.code, kind: "patients", mode };
  }

  const fileResult = await readCsvFile(formData);
  if (!fileResult.ok) {
    return { error: fileResult.error, kind: "patients", mode };
  }

  const parsed = parseCsv(fileResult.text);
  if (!parsed.ok) {
    return {
      error:
        parsed.error === "empty"
          ? "emptyFile"
          : parsed.error === "noHeader"
            ? "missingHeaders"
            : "parseFailed",
      kind: "patients",
      mode,
    };
  }

  if (!hasPatientHeaders(parsed.headers)) {
    return { error: "missingHeaders", kind: "patients", mode };
  }

  if (parsed.rows.length === 0) {
    return { error: "noRows", kind: "patients", mode };
  }
  if (parsed.rows.length > MAX_CSV_ROWS) {
    return { error: "tooManyRows", kind: "patients", mode };
  }

  const { valid, rowErrors } = parsePatients(parsed.rows);
  const base: NonNullable<ImportActionState> = {
    kind: "patients",
    mode,
    totalCount: parsed.rows.length,
    validCount: valid.length,
    errorCount: rowErrors.length,
    rowErrors: rowErrors.slice(0, 50),
    sample: patientSample(valid),
  };

  if (mode === "preview") {
    return base;
  }

  if (rowErrors.length > 0) {
    return { ...base, error: "hasRowErrors" };
  }
  if (valid.length === 0) {
    return { ...base, error: "noRows" };
  }

  for (let i = 0; i < valid.length; i += INSERT_CHUNK) {
    const chunk = valid.slice(i, i + INSERT_CHUNK).map((row) => ({
      clinic_id: profile.clinic_id,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
      email: row.email,
      date_of_birth: row.dateOfBirth,
      address: row.address,
      medical_history: row.medicalHistory,
      notes: row.notes,
    }));
    const { error } = await supabase.from("patients").insert(chunk);
    if (error) {
      return { ...base, error: "importFailed" };
    }
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "patients_csv_imported",
    payload: { count: valid.length },
  });

  revalidatePath(`/${locale}/patients`);
  revalidatePath(`/${locale}/settings/import`);

  return {
    ...base,
    message: "patientsImported",
    importedCount: valid.length,
  };
}

export async function importServicesAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const mode: ImportMode =
    formData.get("mode") === "commit" ? "commit" : "preview";
  const auth = await requireImportProfile(["owner", "accountant"]);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden", kind: "services", mode };
  }
  if (!canImportServices(auth.profile.role)) {
    return { error: "forbidden", kind: "services", mode };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const fileResult = await readCsvFile(formData);
  if (!fileResult.ok) {
    return { error: fileResult.error, kind: "services", mode };
  }

  const parsed = parseCsv(fileResult.text);
  if (!parsed.ok) {
    return {
      error:
        parsed.error === "empty"
          ? "emptyFile"
          : parsed.error === "noHeader"
            ? "missingHeaders"
            : "parseFailed",
      kind: "services",
      mode,
    };
  }

  if (!hasServiceHeaders(parsed.headers)) {
    return { error: "missingHeaders", kind: "services", mode };
  }

  if (parsed.rows.length === 0) {
    return { error: "noRows", kind: "services", mode };
  }
  if (parsed.rows.length > MAX_CSV_ROWS) {
    return { error: "tooManyRows", kind: "services", mode };
  }

  const { valid, rowErrors } = parseServices(parsed.rows);
  const base: NonNullable<ImportActionState> = {
    kind: "services",
    mode,
    totalCount: parsed.rows.length,
    validCount: valid.length,
    errorCount: rowErrors.length,
    rowErrors: rowErrors.slice(0, 50),
    sample: serviceSample(valid),
  };

  if (mode === "preview") {
    return base;
  }

  if (rowErrors.length > 0) {
    return { ...base, error: "hasRowErrors" };
  }
  if (valid.length === 0) {
    return { ...base, error: "noRows" };
  }

  for (let i = 0; i < valid.length; i += INSERT_CHUNK) {
    const chunk = valid.slice(i, i + INSERT_CHUNK).map((row) => ({
      clinic_id: profile.clinic_id,
      name: row.name,
      code: row.code,
      duration_minutes: row.durationMinutes,
      price_eur: row.priceEur,
      vat_rate: row.vatRate,
      location_id: null,
    }));
    const { error } = await supabase.from("services").insert(chunk);
    if (error) {
      return { ...base, error: "importFailed" };
    }
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "services_csv_imported",
    payload: { count: valid.length },
  });

  revalidatePath(`/${locale}/services`);
  revalidatePath(`/${locale}/settings/import`);

  return {
    ...base,
    message: "servicesImported",
    importedCount: valid.length,
  };
}
