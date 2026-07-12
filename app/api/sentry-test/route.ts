import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/** Dev-only: sends a test event so Sentry onboarding clears. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return NextResponse.json(
      { ok: false, error: "NEXT_PUBLIC_SENTRY_DSN missing — restart dev server" },
      { status: 500 },
    );
  }

  const eventId = Sentry.captureMessage("OrdinacijaOS Sentry test", {
    level: "info",
    tags: { source: "sentry-test-api" },
  });

  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    eventId,
    hint: "Check Sentry Issues in ~30s. Dashboard onboarding clears after first event.",
  });
}
