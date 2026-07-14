import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/log";
import { buildPatientExport } from "@/lib/privacy/export";
import { canExportPatientData } from "@/lib/privacy/rbac";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { patientId } = await params;
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

  if (!profile?.is_active || !canExportPatientData(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = await buildPatientExport(
    supabase,
    profile.clinic_id,
    patientId,
  );

  if (!payload) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "gdpr.patient_exported",
    payload: { patient_id: patientId },
  });

  const body = JSON.stringify(payload, null, 2);
  const filename = `patient-${patientId}-export.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
