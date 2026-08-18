import * as Sentry from "@sentry/nextjs";
import {
  isStaleServerActionError,
  isTruncatedUploadError,
} from "@/lib/observability/sentry-privacy";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export function onRequestError(
  ...args: Parameters<typeof Sentry.captureRequestError>
) {
  const error = args[0];
  if (isStaleServerActionError(error) || isTruncatedUploadError(error)) {
    return;
  }
  return Sentry.captureRequestError(...args);
}
