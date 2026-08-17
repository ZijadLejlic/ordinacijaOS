import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blogCatalogLocale, catalogLocale } from "@/i18n/catalog";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function loadCatalog(locale: "bs" | "hr" | "sr" | "en") {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  ) as unknown;
}

describe("catalogLocale", () => {
  it("loads a dedicated catalog per UI locale", () => {
    expect(catalogLocale("bs")).toBe("bs");
    expect(catalogLocale("hr")).toBe("hr");
    expect(catalogLocale("sr")).toBe("sr");
    expect(catalogLocale("en")).toBe("en");
  });

  it("keeps blog MDX on bs/en until dedicated hr/sr posts exist", () => {
    expect(blogCatalogLocale("hr")).toBe("bs");
    expect(blogCatalogLocale("sr")).toBe("bs");
    expect(blogCatalogLocale("en")).toBe("en");
  });
});

describe("message catalogs", () => {
  it("hr and sr keep the same key tree as bs", () => {
    const bs = leafKeys(loadCatalog("bs")).sort();
    expect(leafKeys(loadCatalog("hr")).sort()).toEqual(bs);
    expect(leafKeys(loadCatalog("sr")).sort()).toEqual(bs);
  });

  it("uses EUR in hr/sr public pricing copy (not KM)", () => {
    const hr = loadCatalog("hr") as {
      Marketing: { pricing: { title: string } };
    };
    const sr = loadCatalog("sr") as {
      Marketing: { pricing: { title: string } };
    };
    expect(hr.Marketing.pricing.title).toMatch(/15\s*€/);
    expect(hr.Marketing.pricing.title).not.toMatch(/KM/);
    expect(sr.Marketing.pricing.title).toMatch(/15\s*€/);
    expect(sr.Marketing.pricing.title).not.toMatch(/KM/);
  });
});
