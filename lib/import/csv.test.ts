import { describe, expect, it } from "vitest";
import { normalizeHeader, parseCsv } from "@/lib/import/csv";
import { hasPatientHeaders, mapPatientCsvRow } from "@/lib/import/patients-map";
import { hasServiceHeaders, mapServiceCsvRow } from "@/lib/import/services-map";

describe("parseCsv", () => {
  it("parses comma CSV with headers", () => {
    const result = parseCsv(
      "first_name,last_name,phone\nAna,Hodzic,+38761123456\n",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headers).toEqual(["first_name", "last_name", "phone"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      first_name: "Ana",
      last_name: "Hodzic",
      phone: "+38761123456",
    });
  });

  it("detects semicolon delimiter and strips BOM", () => {
    const result = parseCsv(
      "\uFEFFname;price_eur;vat_rate\nPregled;50;0.17\n",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headers).toEqual(["name", "price_eur", "vat_rate"]);
    expect(result.rows[0]?.name).toBe("Pregled");
  });

  it("handles quoted commas", () => {
    const result = parseCsv('name,notes\n"A, B",ok\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.name).toBe("A, B");
  });

  it("normalizes headers", () => {
    expect(normalizeHeader(" First Name ")).toBe("first_name");
  });
});

describe("mapPatientCsvRow", () => {
  it("maps BS aliases and DOB", () => {
    const result = mapPatientCsvRow(
      {
        ime: "Marko",
        prezime: "Markovic",
        telefon: "+38760",
        datum_rodjenja: "15.03.1990",
      },
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.firstName).toBe("Marko");
    expect(result.data.dateOfBirth).toBe("1990-03-15");
  });

  it("rejects missing last name", () => {
    const result = mapPatientCsvRow({ first_name: "Ana", last_name: "" }, 2);
    expect(result.ok).toBe(false);
  });

  it("detects required headers", () => {
    expect(hasPatientHeaders(["ime", "prezime"])).toBe(true);
    expect(hasPatientHeaders(["name", "price"])).toBe(false);
  });
});

describe("mapServiceCsvRow", () => {
  it("defaults duration and normalizes vat percent", () => {
    const result = mapServiceCsvRow(
      { name: "Plomba", cijena: "80,50", pdv: "17" },
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.durationMinutes).toBe(30);
    expect(result.data.priceEur).toBe(80.5);
    expect(result.data.vatRate).toBe(0.17);
  });

  it("requires name and price headers", () => {
    expect(hasServiceHeaders(["naziv", "cijena"])).toBe(true);
    expect(hasServiceHeaders(["name"])).toBe(false);
  });
});
