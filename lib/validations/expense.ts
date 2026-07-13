import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "supplies",
  "lab",
  "rent",
  "utilities",
  "salaries",
  "equipment",
  "marketing",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive().max(999_999.99),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: z.string().uuid(),
});

export const voidExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});
