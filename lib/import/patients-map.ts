import { createPatientSchema } from "@/lib/validations/patient";
import { cell } from "@/lib/import/csv";

const FIRST_NAME = ["first_name", "firstname", "ime"] as const;
const LAST_NAME = ["last_name", "lastname", "prezime"] as const;
const PHONE = ["phone", "telefon", "tel"] as const;
const EMAIL = ["email", "e_mail"] as const;
const DOB = ["date_of_birth", "dob", "datum_rodjenja", "datum_rođenja"] as const;
const ADDRESS = ["address", "adresa"] as const;
const HISTORY = ["medical_history", "anamneza", "medicalhistory"] as const;
const NOTES = ["notes", "napomene", "napomena"] as const;

export type PatientImportRow = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  medicalHistory: string | null;
  notes: string | null;
};

export type PatientRowResult =
  | { ok: true; rowNumber: number; data: PatientImportRow }
  | { ok: false; rowNumber: number; message: string };

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

/** Normalize common EU date inputs to YYYY-MM-DD when possible. */
function normalizeDob(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, "0");
    const month = dmy[2]!.padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }
  return v;
}

export function mapPatientCsvRow(
  row: Record<string, string>,
  rowNumber: number,
): PatientRowResult {
  const parsed = createPatientSchema.safeParse({
    firstName: cell(row, FIRST_NAME),
    lastName: cell(row, LAST_NAME),
    phone: cell(row, PHONE),
    email: cell(row, EMAIL),
    dateOfBirth: normalizeDob(cell(row, DOB)),
    address: cell(row, ADDRESS),
    medicalHistory: cell(row, HISTORY),
    notes: cell(row, NOTES),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      rowNumber,
      message: issue?.path?.[0]
        ? `${String(issue.path[0])}: ${issue.message}`
        : "invalid",
    };
  }

  return {
    ok: true,
    rowNumber,
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: emptyToNull(parsed.data.phone ?? ""),
      email: emptyToNull(parsed.data.email ?? ""),
      dateOfBirth: emptyToNull(parsed.data.dateOfBirth ?? ""),
      address: emptyToNull(parsed.data.address ?? ""),
      medicalHistory: emptyToNull(parsed.data.medicalHistory ?? ""),
      notes: emptyToNull(parsed.data.notes ?? ""),
    },
  };
}

export function hasPatientHeaders(headers: string[]): boolean {
  const set = new Set(headers);
  const hasFirst = FIRST_NAME.some((h) => set.has(h));
  const hasLast = LAST_NAME.some((h) => set.has(h));
  return hasFirst && hasLast;
}
