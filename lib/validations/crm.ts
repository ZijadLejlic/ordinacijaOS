import { z } from "zod";
import { CRM_KINDS } from "@/lib/crm/constants";
import { EMAIL_TEMPLATE_LOCALES } from "@/lib/email/templates";

export const sendCrmNotificationSchema = z.object({
  notificationId: z.string().uuid(),
  locale: z.enum(EMAIL_TEMPLATE_LOCALES).optional(),
});

export type SendCrmNotificationInput = z.infer<
  typeof sendCrmNotificationSchema
>;

export const dismissCrmNotificationSchema = z.object({
  notificationId: z.string().uuid(),
});

export type DismissCrmNotificationInput = z.infer<
  typeof dismissCrmNotificationSchema
>;

export const crmKindSchema = z.enum(CRM_KINDS);
