import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ops health — public: liveness only.
 * Detailed env booleans (no secret values): Authorization Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const secret = process.env.CRON_SECRET;
  const detailed = Boolean(secret && bearer === secret);

  if (!detailed) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const looksLocal =
    appUrl.includes("localhost") || appUrl.includes("127.0.0.1");

  return NextResponse.json({
    ok: true,
    checks: {
      appUrl: Boolean(appUrl),
      appUrlLooksProduction: Boolean(appUrl) && !looksLocal,
      emailFrom: Boolean(process.env.EMAIL_FROM),
      resend: Boolean(process.env.RESEND_API_KEY),
      cron: Boolean(process.env.CRON_SECRET),
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      demoClinic: Boolean(
        process.env.DEMO_CLINIC_EMAIL && process.env.DEMO_CLINIC_PASSWORD,
      ),
      sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      posthog: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    },
  });
}
