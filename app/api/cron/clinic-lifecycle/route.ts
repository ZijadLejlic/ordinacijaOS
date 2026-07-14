import { NextResponse } from "next/server";
import { runClinicLifecycleJob } from "@/lib/clinic/lifecycle-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron / manual: trial expiry → readonly → hard delete (D6 / D45).
 * Auth: `Authorization: Bearer $CRON_SECRET` (or `?secret=` for local smoke tests).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  if (bearer !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runClinicLifecycleJob();
    return NextResponse.json({
      ok: true,
      markedReadonly: result.markedReadonly.length,
      markedPendingDelete: result.markedPendingDelete.length,
      deleted: result.deleted.map((d) => ({
        clinicId: d.clinicId,
        ok: d.ok,
        error: d.error ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "job_failed";
    console.error("[cron.clinic_lifecycle]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
