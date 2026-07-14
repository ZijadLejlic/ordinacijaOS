import { z } from "zod";
import {
  CONSENT_TEMPLATE_KEYS,
  CONSENT_TEMPLATE_LOCALES,
} from "@/lib/consent/templates";

export const updateConsentFormSchema = z.object({
  templateKey: z.enum(CONSENT_TEMPLATE_KEYS),
  locale: z.enum(CONSENT_TEMPLATE_LOCALES),
  title: z.string().trim().min(1).max(200),
  bodyText: z.string().trim().min(1).max(20000),
});

export const signConsentSchema = z.object({
  patientId: z.string().uuid(),
  consentFormId: z.string().uuid(),
  /** PNG data URL from canvas (draw signature). */
  signatureDataUrl: z
    .string()
    .min(32)
    .max(1_500_000)
    .refine(
      (v) => v.startsWith("data:image/png;base64,"),
      "signatureMustBePng",
    ),
});
