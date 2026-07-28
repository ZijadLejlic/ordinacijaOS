import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";

/**
 * Optional Server Action wrapper for performance + error capture.
 * Does **not** attach FormData / response bodies (privacy-safe for medical data).
 * Prefer catching expected validation yourself and only letting unexpected errors throw.
 *
 * Server-only — do not import from Client Components.
 */
export async function withObservedServerAction<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.withServerActionInstrumentation(
    name,
    {
      headers: await headers(),
      recordResponse: false,
    },
    fn,
  );
}
