import { z } from "zod";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LOCALES,
} from "@/lib/email/templates";

export const updateEmailTemplateSchema = z.object({
  templateKey: z.enum(EMAIL_TEMPLATE_KEYS),
  locale: z.enum(EMAIL_TEMPLATE_LOCALES),
  subject: z.string().trim().min(1).max(200),
  bodyText: z.string().trim().min(1).max(10000),
});

export type UpdateEmailTemplateInput = z.infer<
  typeof updateEmailTemplateSchema
>;

export const sendTestEmailSchema = z.object({
  templateKey: z.enum(EMAIL_TEMPLATE_KEYS),
  locale: z.enum(EMAIL_TEMPLATE_LOCALES),
});

export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;

export const sendAppointmentReminderSchema = z.object({
  appointmentId: z.string().uuid(),
  locale: z.enum(EMAIL_TEMPLATE_LOCALES).optional(),
});

export type SendAppointmentReminderInput = z.infer<
  typeof sendAppointmentReminderSchema
>;
