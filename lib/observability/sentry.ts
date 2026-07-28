import * as Sentry from "@sentry/nextjs";
import { isExpectedBusinessError } from "@/lib/observability/sentry-privacy";

export type SentryAuthContext = {
  userId: string;
  clinicId?: string | null;
  role?: string | null;
};

/**
 * Safe Sentry context after authentication (D33).
 * - user.id only (never email / display name)
 * - clinic_id + role as tags
 */
export function setSentryAuthContext(input: SentryAuthContext) {
  Sentry.setUser({ id: input.userId });
  if (input.clinicId) {
    Sentry.setTag("clinic_id", input.clinicId);
  }
  if (input.role) {
    Sentry.setTag("role", input.role);
  }
}

/** @deprecated Prefer setSentryAuthContext — kept for existing call sites. */
export function setClinicErrorContext(input: {
  clinicId?: string | null;
  role?: string | null;
  userId?: string | null;
}) {
  if (input.userId) {
    Sentry.setUser({ id: input.userId });
  }
  Sentry.setTag("clinic_id", input.clinicId ?? "unknown");
  if (input.role) {
    Sentry.setTag("role", input.role);
  }
}

/** Clear user + tenant tags on logout. */
export function clearSentryAuthContext() {
  Sentry.setUser(null);
  Sentry.setTag("clinic_id", "");
  Sentry.setTag("role", "");
}

export type CaptureUnexpectedOptions = {
  feature?: string;
  operation?: string;
  /** Extra tags only — never pass form payloads or PHI. */
  tags?: Record<string, string>;
};

/**
 * Manual capture for unexpected failures.
 * Skips expected business validation (credentials, overlap, 401/403, etc.).
 * Never attach full form payloads to `tags` or elsewhere.
 */
export function captureUnexpectedError(
  error: unknown,
  options?: CaptureUnexpectedOptions,
): string | undefined {
  if (isExpectedBusinessError(error)) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    if (options?.feature) {
      scope.setTag("feature", options.feature);
    }
    if (options?.operation) {
      scope.setTag("operation", options.operation);
    }
    if (options?.tags) {
      for (const [key, value] of Object.entries(options.tags)) {
        // Defensive: reject obvious PHI key names.
        if (/email|phone|patient|name|password|token|body|form/i.test(key)) {
          continue;
        }
        scope.setTag(key, value);
      }
    }
    return Sentry.captureException(error);
  });
}
