import { z } from "zod";

export const leadPreferredTimes = ["morning", "afternoon", "anytime"] as const;

export const submitLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clinicName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.union([
    z.literal(""),
    z.string().trim().email().max(200),
  ]),
  preferredTime: z.enum(leadPreferredTimes),
  message: z.union([
    z.literal(""),
    z.string().trim().max(1000),
  ]),
  gdpr: z.literal("on"),
  locale: z.enum(["bs", "en"]).default("bs"),
  sourcePage: z.string().trim().min(1).max(80).default("contact"),
  /** Honeypot — must stay empty. */
  website: z.union([z.literal(""), z.undefined()]),
});

export type SubmitLeadInput = z.infer<typeof submitLeadSchema>;
