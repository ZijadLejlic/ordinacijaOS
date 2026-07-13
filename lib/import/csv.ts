/** Minimal RFC4180-ish CSV parser (comma or semicolon). No external dependency. */

export type CsvParseResult =
  | { ok: true; headers: string[]; rows: Record<string, string>[] }
  | { ok: false; error: "empty" | "noHeader" | "parseFailed" };

export const MAX_CSV_BYTES = 1_000_000;
export const MAX_CSV_ROWS = 500;

export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function detectDelimiter(headerLine: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") commas++;
    if (ch === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

function parseLine(line: string, delimiter: "," | ";"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Split on newlines outside quotes. */
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.trim().length > 0) records.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) records.push(current);
  return records;
}

export function parseCsv(text: string): CsvParseResult {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return { ok: false, error: "empty" };

  const records = splitRecords(cleaned);
  if (records.length === 0) return { ok: false, error: "empty" };

  const delimiter = detectDelimiter(records[0]!);
  const rawHeaders = parseLine(records[0]!, delimiter);
  const headers = rawHeaders.map(normalizeHeader);

  if (headers.length === 0 || headers.every((h) => !h)) {
    return { ok: false, error: "noHeader" };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const cells = parseLine(records[i]!, delimiter);
    // Skip blank lines
    if (cells.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]!;
      if (!key) continue;
      row[key] = (cells[c] ?? "").trim();
    }
    rows.push(row);
  }

  return { ok: true, headers, rows };
}

export function cell(
  row: Record<string, string>,
  aliases: readonly string[],
): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}
