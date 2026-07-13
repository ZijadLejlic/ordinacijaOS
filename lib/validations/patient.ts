import { z } from "zod";

export const allergySeverities = [
  "mild",
  "moderate",
  "severe",
  "unknown",
] as const;

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  dateOfBirth: z.string().trim().max(10).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  medicalHistory: z.string().trim().max(4000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const updatePatientSchema = createPatientSchema;

export const patientSearchSchema = z.object({
  q: z.string().trim().max(120).optional().or(z.literal("")),
});

export const createAllergySchema = z.object({
  allergen: z.string().trim().min(1).max(200),
  severity: z.enum(allergySeverities),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const documentTitleSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const imageTitleSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CreateAllergyInput = z.infer<typeof createAllergySchema>;
export type DocumentTitleInput = z.infer<typeof documentTitleSchema>;
export type ImageTitleInput = z.infer<typeof imageTitleSchema>;
