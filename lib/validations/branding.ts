import { z } from "zod";

const hexOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^#[0-9A-Fa-f]{6}$/.test(v), "invalidHex")
  .transform((v) => (v === "" ? null : v));

export const updateBrandingColorsSchema = z.object({
  background: hexOrEmpty,
  text: hexOrEmpty,
  accent: hexOrEmpty,
});

export type UpdateBrandingColorsInput = z.infer<
  typeof updateBrandingColorsSchema
>;
