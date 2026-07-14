import { z } from "zod";

const nonNegQty = z.coerce.number().min(0).max(1_000_000_000);

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20),
  quantity: nonNegQty,
  lowStockThreshold: nonNegQty,
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateInventoryItemSchema = createInventoryItemSchema.extend({
  itemId: z.string().uuid(),
});

export const adjustInventoryQtySchema = z.object({
  itemId: z.string().uuid(),
  delta: z.coerce.number().min(-1_000_000_000).max(1_000_000_000).refine((n) => n !== 0, {
    message: "deltaZero",
  }),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
