import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(60).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(1).max(600),
  priceEur: z.coerce.number().min(0).max(1_000_000),
  vatRate: z.coerce.number().min(0).max(1),
  locationId: z.string().uuid().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional(),
});

export const updateServiceSchema = createServiceSchema;

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
