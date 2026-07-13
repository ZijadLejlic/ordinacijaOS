import { createServiceSchema } from "@/lib/validations/service";
import { cell } from "@/lib/import/csv";

const NAME = ["name", "naziv", "usluga"] as const;
const CODE = ["code", "sifra", "šifra"] as const;
const DURATION = ["duration_minutes", "duration", "trajanje", "trajanje_min"] as const;
const PRICE = ["price_eur", "price", "cijena", "cijena_eur"] as const;
const VAT = ["vat_rate", "vat", "pdv", "pdv_stopa"] as const;

export type ServiceImportRow = {
  name: string;
  code: string | null;
  durationMinutes: number;
  priceEur: number;
  vatRate: number;
};

export type ServiceRowResult =
  | { ok: true; rowNumber: number; data: ServiceImportRow }
  | { ok: false; rowNumber: number; message: string };

function parseNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Accept 0.17 or 17 (%) → fraction 0–1. */
function normalizeVat(raw: string): number | null {
  if (!raw.trim()) return 0.17;
  const n = parseNumber(raw);
  if (n === null) return null;
  if (n > 1 && n <= 100) return n / 100;
  return n;
}

export function mapServiceCsvRow(
  row: Record<string, string>,
  rowNumber: number,
): ServiceRowResult {
  const durationRaw = cell(row, DURATION);
  const priceRaw = cell(row, PRICE);
  const vatRaw = cell(row, VAT);

  const duration =
    durationRaw.trim() === "" ? 30 : parseNumber(durationRaw);
  const price = parseNumber(priceRaw);
  const vat = normalizeVat(vatRaw);

  if (price === null) {
    return { ok: false, rowNumber, message: "price_eur: invalid" };
  }
  if (duration === null) {
    return { ok: false, rowNumber, message: "duration_minutes: invalid" };
  }
  if (vat === null) {
    return { ok: false, rowNumber, message: "vat_rate: invalid" };
  }

  const parsed = createServiceSchema.safeParse({
    name: cell(row, NAME),
    code: cell(row, CODE),
    durationMinutes: duration,
    priceEur: price,
    vatRate: vat,
    locationId: "",
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
      name: parsed.data.name,
      code: parsed.data.code ? parsed.data.code : null,
      durationMinutes: parsed.data.durationMinutes,
      priceEur: parsed.data.priceEur,
      vatRate: parsed.data.vatRate,
    },
  };
}

export function hasServiceHeaders(headers: string[]): boolean {
  const set = new Set(headers);
  const hasName = NAME.some((h) => set.has(h));
  const hasPrice = PRICE.some((h) => set.has(h));
  return hasName && hasPrice;
}
