import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const updateLocationSchema = createLocationSchema.extend({
  locationId: z.string().uuid(),
});

export const setLocationActiveSchema = z.object({
  locationId: z.string().uuid(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const sharedPricelistSchema = z.object({
  sharedPricelistAcrossLocations: z.boolean(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
