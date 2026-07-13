import { z } from "zod";
import { TOOTH_STATUSES } from "@/lib/odontogram/fdi";

export const updateToothStatusSchema = z.object({
  fdiNumber: z.coerce.number().int(),
  status: z.enum(TOOTH_STATUSES),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type UpdateToothStatusInput = z.infer<typeof updateToothStatusSchema>;
