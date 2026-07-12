import * as Sentry from "@sentry/nextjs";

/** Safe Sentry context — never attach patient PII (D33). */
export function setClinicErrorContext(input: {
  clinicId?: string | null;
  role?: string | null;
}) {
  Sentry.setTag("clinic_id", input.clinicId ?? "unknown");
  if (input.role) {
    Sentry.setTag("role", input.role);
  }
}
