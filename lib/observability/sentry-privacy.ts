import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Medical/dental privacy scrubbing for Sentry (D33).
 * Never send patient PHI, auth tokens, cookies, or form bodies.
 */

const SENSITIVE_KEY =
  /^(?:authorization|cookie|set-cookie|x-supabase.*|apikey|api[-_]?key|password|passwd|secret|token|refresh[-_]?token|access[-_]?token|sb-.*|jmbg|oib|iban|ssn|email|phone|address|diagnosis|treatment|note|notes|anamnesis|medication|patient|full[_-]?name|first[_-]?name|last[_-]?name|display[_-]?name|body|formdata|form[_-]?data|payload|raw[_-]?body)$/i;

const SENSITIVE_KEY_PARTIAL =
  /name|email|phone|patient|address|jmbg|oib|iban|diagnos|treatment|note|password|token|cookie|authorization|supabase/i;

/** Expected business outcomes — never report as exceptions. */
const EXPECTED_MESSAGE =
  /invalid\s*credentials|invalidCredentials|emailTaken|missingClinic|locked|required.?field|validation(?:\s*error)?|appointment.?overlap|slot.?taken|overlap|unauthorized|forbidden|\b401\b|\b403\b|not\s*authenticated|permission\s*denied|featureDisabled|userLimit|planLimit|readonly/i;

/** Intentional smoke / browser noise — never report as product bugs. */
const DROP_MESSAGE =
  /DentOrd Sentry (?:client|server)?\s*test|REMOVE (?:page|endpoint)|Non-Error promise rejection captured with value: undefined|Failed to find Server Action|older or newer deployment|Unexpected end of form/i;

/** Stale Next.js Server Action ID after a deploy (client still has the old bundle). */
export function isStaleServerActionError(error: unknown): boolean {
  const parts: string[] = [];
  if (typeof error === "string") parts.push(error);
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  } else if (error && typeof error === "object" && "message" in error) {
    parts.push(String((error as { message: unknown }).message));
  }
  return /Failed to find Server Action|older or newer deployment/i.test(
    parts.join("\n"),
  );
}

/** Truncated multipart (iOS Safari file upload) — form error, not a crash. */
export function isTruncatedUploadError(error: unknown): boolean {
  const parts: string[] = [];
  if (typeof error === "string") parts.push(error);
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  } else if (error && typeof error === "object" && "message" in error) {
    parts.push(String((error as { message: unknown }).message));
  }
  return /Unexpected end of form/i.test(parts.join("\n"));
}

export function isExpectedBusinessError(error: unknown): boolean {
  if (!error) return false;
  if (isStaleServerActionError(error)) return true;
  if (isTruncatedUploadError(error)) return true;

  if (typeof error === "object" && error !== null) {
    const record = error as {
      digest?: string;
      name?: string;
      message?: string;
      status?: number;
      statusCode?: number;
      code?: string | number;
      expected?: boolean;
    };

    if (record.expected === true) return true;
    if (record.name === "ExpectedError" || record.name === "ValidationError") {
      return true;
    }

    const status = record.status ?? record.statusCode;
    if (status === 401 || status === 403) return true;

    if (typeof record.message === "string" && EXPECTED_MESSAGE.test(record.message)) {
      return true;
    }
  }

  if (typeof error === "string" && EXPECTED_MESSAGE.test(error)) {
    return true;
  }

  return false;
}

function scrubRecord(
  input: Record<string, unknown> | undefined,
  depth = 0,
): Record<string, unknown> | undefined {
  if (!input || depth > 4) return undefined;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key) || SENSITIVE_KEY_PARTIAL.test(key)) {
      out[key] = "[Filtered]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = scrubRecord(value as Record<string, unknown>, depth + 1);
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === "object"
          ? scrubRecord(item as Record<string, unknown>, depth + 1)
          : item,
      );
      continue;
    }
    out[key] = value;
  }

  return out;
}

function scrubRequest(event: ErrorEvent): void {
  const request = event.request;
  if (!request) return;

  if (request.cookies) {
    request.cookies = {};
  }
  if (request.data) {
    request.data = "[Filtered]";
  }
  if (request.headers) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (SENSITIVE_KEY.test(key) || SENSITIVE_KEY_PARTIAL.test(key)) {
        headers[key] = "[Filtered]";
      } else {
        headers[key] = value;
      }
    }
    request.headers = headers;
  }
  if (request.query_string && typeof request.query_string === "string") {
    // Drop query strings that may contain tokens or emails.
    if (SENSITIVE_KEY_PARTIAL.test(request.query_string)) {
      request.query_string = "[Filtered]";
    }
  }
}

function scrubUser(event: ErrorEvent): void {
  if (!event.user) return;
  // Only id is allowed (no email / username / ip).
  const id = event.user.id;
  event.user = id != null ? { id: String(id) } : undefined;
}

/**
 * Shared beforeSend for client / server / edge.
 * Returns null to drop expected business errors.
 */
function eventTextBlob(event: ErrorEvent, original: unknown): string {
  const parts: string[] = [];
  if (typeof event.message === "string") parts.push(event.message);
  if (original instanceof Error) parts.push(original.message);
  else if (typeof original === "string") parts.push(original);
  for (const ex of event.exception?.values ?? []) {
    if (ex.type) parts.push(ex.type);
    if (ex.value) parts.push(ex.value);
  }
  return parts.join("\n");
}

export function sanitizeSentryEvent(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  const original =
    hint?.originalException ?? hint?.syntheticException ?? undefined;
  if (isExpectedBusinessError(original)) {
    return null;
  }
  if (event.message && EXPECTED_MESSAGE.test(event.message)) {
    return null;
  }

  const blob = eventTextBlob(event, original);
  if (blob && DROP_MESSAGE.test(blob)) {
    return null;
  }

  scrubUser(event);
  scrubRequest(event);

  if (event.extra) {
    event.extra = scrubRecord(event.extra as Record<string, unknown>);
  }
  if (event.contexts) {
    const contexts: NonNullable<ErrorEvent["contexts"]> = {};
    for (const [name, ctx] of Object.entries(event.contexts)) {
      if (!ctx || typeof ctx !== "object") {
        contexts[name] = ctx;
        continue;
      }
      contexts[name] = scrubRecord(ctx as Record<string, unknown>) as typeof ctx;
    }
    event.contexts = contexts;
  }

  // Breadcrumb data may contain form field names — scrub values for input/ui.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (!crumb.data) return crumb;
      return {
        ...crumb,
        data: scrubRecord(crumb.data as Record<string, unknown>),
      };
    });
  }

  return event;
}
