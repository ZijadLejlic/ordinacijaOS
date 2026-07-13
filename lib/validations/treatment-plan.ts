import { z } from "zod";

export const treatmentPlanItemStatuses = [
  "planned",
  "in_progress",
  "done",
  "cancelled",
] as const;

export const createTreatmentPlanSchema = z.object({
  title: z.string().trim().min(1).max(255),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const addTreatmentPlanItemSchema = z.object({
  serviceId: z.string().uuid(),
  fdiNumber: z
    .union([z.literal(""), z.coerce.number().int()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  estimatedPriceEur: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(treatmentPlanItemStatuses).optional(),
});

export const updateTreatmentPlanItemStatusSchema = z.object({
  status: z.enum(treatmentPlanItemStatuses),
});

export type CreateTreatmentPlanInput = z.infer<typeof createTreatmentPlanSchema>;
export type AddTreatmentPlanItemInput = z.infer<
  typeof addTreatmentPlanItemSchema
>;
