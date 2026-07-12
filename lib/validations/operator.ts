import { z } from "zod";

export const operatorPinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/);

export const createOperatorSchema = z.object({
  profileId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80),
  pin: operatorPinSchema,
});

export const updateOperatorPinSchema = z.object({
  operatorId: z.string().uuid(),
  pin: operatorPinSchema,
});

export const setOperatorActiveSchema = z.object({
  operatorId: z.string().uuid(),
  isActive: z.boolean(),
});

export const switchOperatorSchema = z.object({
  operatorId: z.string().uuid(),
  pin: operatorPinSchema,
});
