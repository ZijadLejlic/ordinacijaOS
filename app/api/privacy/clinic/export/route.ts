import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/log";
import { buildClinicExportZip } from "@/lib/privacy/clinic-export";
import { canExportClinicBackup } from "@/lib/privacy/rbac";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canExportClinicBackup(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { buffer, filename, manifest } = await buildClinicExportZip(
      supabase,
      profile.clinic_id,
    );

    await writeAuditEvent(supabase, {
      clinicId: profile.clinic_id,
      actorUserId: user.id,
      eventName: "clinic.backup_exported",
      payload: {
        scope: manifest.scope,
        counts: manifest.counts,
      },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export_failed";
    if (message === "clinic_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[clinic.backup_export]", message);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
