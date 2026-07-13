import { z } from "zod";

export const appointmentStatuses = [
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export const waitlistStatuses = [
  "waiting",
  "offered",
  "booked",
  "cancelled",
] as const;

const optionalUuid = z
  .union([z.literal(""), z.string().uuid()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const createAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  patientId: z.string().uuid(),
  locationId: optionalUuid,
  serviceId: optionalUuid,
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(appointmentStatuses).default("confirmed"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  patientId: z.string().uuid(),
  locationId: optionalUuid,
  serviceId: optionalUuid,
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(appointmentStatuses),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const rescheduleAppointmentSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(appointmentStatuses),
});

export const addWaitlistSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: optionalUuid,
  serviceId: optionalUuid,
  locationId: optionalUuid,
  preferredFrom: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  preferredTo: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AddWaitlistInput = z.infer<typeof addWaitlistSchema>;
