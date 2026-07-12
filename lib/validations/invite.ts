import { z } from "zod";

export const staffInviteRoles = [
  "doctor",
  "assistant",
  "reception",
  "accountant",
  "technician",
] as const;

export const createInviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(staffInviteRoles),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8).max(72),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
