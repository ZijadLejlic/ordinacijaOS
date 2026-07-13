import type { Json } from "@/lib/supabase/database.types";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export type BrandingColors = {
  background: string | null;
  text: string | null;
  accent: string | null;
};

export type ClinicBranding = {
  logoPath: string | null;
  /** Legacy absolute URL (invoice PDF fallback). Prefer logoPath. */
  logoUrl: string | null;
  colors: BrandingColors;
};

export function parseBrandingJson(value: Json | null | undefined): ClinicBranding {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const colorsRaw =
    raw.colors && typeof raw.colors === "object" && !Array.isArray(raw.colors)
      ? (raw.colors as Record<string, unknown>)
      : {};

  return {
    logoPath: typeof raw.logo_path === "string" ? raw.logo_path : null,
    logoUrl: typeof raw.logo_url === "string" ? raw.logo_url : null,
    colors: {
      background: hexOrNull(colorsRaw.background),
      text: hexOrNull(colorsRaw.text),
      accent: hexOrNull(colorsRaw.accent),
    },
  };
}

function hexOrNull(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value) ? value : null;
}

export function brandingToJson(branding: ClinicBranding): Json {
  const colors: Record<string, string> = {};
  if (branding.colors.background) colors.background = branding.colors.background;
  if (branding.colors.text) colors.text = branding.colors.text;
  if (branding.colors.accent) colors.accent = branding.colors.accent;

  const next: Record<string, unknown> = {};
  if (branding.logoPath) next.logo_path = branding.logoPath;
  if (branding.logoUrl) next.logo_url = branding.logoUrl;
  if (Object.keys(colors).length > 0) next.colors = colors;
  return next as Json;
}

export function hasCustomColors(colors: BrandingColors): boolean {
  return Boolean(colors.background || colors.text || colors.accent);
}
