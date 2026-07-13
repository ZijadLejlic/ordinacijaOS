import { z } from "zod";
import { WEEKDAYS } from "@/lib/onboarding/parse";
import { onboardingInviteRoles } from "@/lib/onboarding/rbac";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");

const dayHoursSchema = z
  .object({
    closed: z.boolean(),
    open: timeSchema,
    close: timeSchema,
  })
  .superRefine((day, ctx) => {
    if (!day.closed && day.open >= day.close) {
      ctx.addIssue({
        code: "custom",
        message: "openBeforeClose",
        path: ["close"],
      });
    }
  });

const workingHoursSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, dayHoursSchema])) as Record<
    (typeof WEEKDAYS)[number],
    typeof dayHoursSchema
  >,
);

export const onboardingClinicSchema = z.object({
  clinicName: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(64),
  phoneCountryDefault: z
    .string()
    .trim()
    .regex(/^\+\d{1,4}$/),
  workingHours: workingHoursSchema,
});

export const onboardingServiceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(60).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(1).max(600),
  priceEur: z.coerce.number().min(0).max(1_000_000),
  vatRate: z.coerce.number().min(0).max(1),
});

export const onboardingInviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(onboardingInviteRoles),
});

export type OnboardingClinicInput = z.infer<typeof onboardingClinicSchema>;
export type OnboardingServiceInput = z.infer<typeof onboardingServiceSchema>;
export type OnboardingInviteInput = z.infer<typeof onboardingInviteSchema>;
