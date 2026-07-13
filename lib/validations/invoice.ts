import { z } from "zod";

const optionalUuid = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v))
  .pipe(z.union([z.string().uuid(), z.null()]));

export const invoiceLineInputSchema = z.object({
  serviceId: optionalUuid.optional().default(null),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(9999),
  unitPrice: z.coerce.number().min(0).max(999_999.99),
  vatRate: z.coerce.number().min(0).max(1),
});

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  locationId: optionalUuid.optional().default(null),
  doctorId: optionalUuid.optional().default(null),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  linesJson: z.string().min(2),
});

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive().max(999_999.99),
  method: z.enum(["cash", "card", "bank_transfer", "other"]),
  paidAt: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : null)),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const createPaymentPlanSchema = z.object({
  invoiceId: z.string().uuid(),
  installmentCount: z.coerce.number().int().min(2).max(48),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const cancelPaymentPlanSchema = z.object({
  paymentPlanId: z.string().uuid(),
});

export const updateInvoiceLegalSettingsSchema = z.object({
  legalName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  taxId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;
