import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { areSentryTestEndpointsEnabled } from "@/lib/observability/sentry-env";
import {
  captureUnexpectedError,
  setSentryAuthContext,
} from "@/lib/observability/sentry";

/**
 * TEMPORARY Sentry verification endpoint — REMOVE after verification
 * (see docs/Sentry.md).
 *
 * Enabled when NODE_ENV !== "production" OR SENTRY_ENABLE_TEST_ENDPOINTS=1.
 *
 * Modes:
 *   GET /api/sentry-test           → captureMessage (default)
 *   GET /api/sentry-test?mode=error → throw (stack + source maps)
 */
export async function GET(request: Request) {
  if (!areSentryTestEndpointsEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return NextResponse.json(
      {
        ok: false,
        error: "NEXT_PUBLIC_SENTRY_DSN missing — set env and redeploy/restart",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "message";

  // Synthetic auth context for verifying user.id + clinic_id tags (not real PHI).
  setSentryAuthContext({
    userId: "sentry-test-user",
    clinicId: "00000000-0000-4000-8000-000000000001",
    role: "owner",
  });

  Sentry.addBreadcrumb({
    category: "sentry-test",
    message: "server sentry-test breadcrumb",
    level: "info",
    data: { mode },
  });

  if (mode === "error") {
    // Intentional throw for source-map / release / trace verification.
    throw new Error("DentOrd Sentry server test error (REMOVE endpoint)");
  }

  const eventId = captureUnexpectedError(
    new Error("DentOrd Sentry server test capture (REMOVE endpoint)"),
    { feature: "sentry-test", operation: "api.sentry-test" },
  );

  // Also send a plain message for onboarding dashboards.
  const messageId = Sentry.captureMessage("DentOrd Sentry test", {
    level: "info",
    tags: { source: "sentry-test-api", feature: "sentry-test" },
  });

  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    eventId: eventId ?? messageId,
    messageId,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV,
    release:
      process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    hint: "TEMPORARY — remove app/api/sentry-test after verification. Check Issues for environment, release, user id, clinic_id, breadcrumbs, trace.",
  });
}
