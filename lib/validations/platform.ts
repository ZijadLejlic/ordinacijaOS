import { z } from "zod";

export const clinicStatusSchema = z.enum([
  "active",
  "readonly",
  "pending_delete",
]);

export const subscriptionStatusSchema = z.enum([
  "trial",
  "active",
  "past_due",
  "canceled",
  "readonly",
]);

export const updateClinicStatusSchema = z.object({
  clinicId: z.string().uuid(),
  status: clinicStatusSchema,
});

export const updateClinicPlanSchema = z.object({
  clinicId: z.string().uuid(),
  planId: z.string().uuid(),
});

export const updateSubscriptionStatusSchema = z.object({
  clinicId: z.string().uuid(),
  status: subscriptionStatusSchema,
});

export const startImpersonationSchema = z.object({
  clinicId: z.string().uuid(),
});

export type ClinicStatus = z.infer<typeof clinicStatusSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
