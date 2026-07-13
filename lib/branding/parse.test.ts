import { describe, expect, it } from "vitest";
import {
  brandingToJson,
  hasCustomColors,
  parseBrandingJson,
} from "@/lib/branding/parse";

describe("parseBrandingJson", () => {
  it("returns empty defaults for null/invalid", () => {
    expect(parseBrandingJson(null)).toEqual({
      logoPath: null,
      logoUrl: null,
      colors: { background: null, text: null, accent: null },
    });
    expect(parseBrandingJson("x" as never).logoPath).toBeNull();
  });

  it("parses logo_path and hex colors", () => {
    const parsed = parseBrandingJson({
      logo_path: "cid/logo.webp",
      colors: {
        background: "#f8fafc",
        text: "#0f172a",
        accent: "#not-hex",
      },
    });
    expect(parsed.logoPath).toBe("cid/logo.webp");
    expect(parsed.colors.background).toBe("#f8fafc");
    expect(parsed.colors.text).toBe("#0f172a");
    expect(parsed.colors.accent).toBeNull();
    expect(hasCustomColors(parsed.colors)).toBe(true);
  });

  it("round-trips via brandingToJson", () => {
    const branding = parseBrandingJson({
      logo_path: "a/logo.webp",
      colors: { accent: "#112233" },
    });
    expect(brandingToJson(branding)).toEqual({
      logo_path: "a/logo.webp",
      colors: { accent: "#112233" },
    });
  });
});
