"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { assertFeature } from "@/lib/entitlements";
import { isValidFdi } from "@/lib/odontogram/fdi";
import { canWriteOdontogram } from "@/lib/patients/rbac";
import { createClient } from "@/lib/supabase/server";
import { updateToothStatusSchema } from "@/lib/validations/odontogram";

export type OdontogramActionState = {
  error?: string;
  message?: string;
} | null;

async function requireOdontogramWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canWriteOdontogram(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile };
}

export async function upsertToothStatusAction(
  patientId: string,
  _prev: OdontogramActionState,
  formData: FormData,
): Promise<OdontogramActionState> {
  const parsed = updateToothStatusSchema.safeParse({
    fdiNumber: formData.get("fdiNumber"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success || !isValidFdi(parsed.data.fdiNumber)) {
    return { error: "invalid" };
  }

  const auth = await requireOdontogramWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(supabase, profile.clinic_id, "odontogram");
  if (!feature.ok) {
    return { error: feature.code };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!patient) {
    return { error: "patientNotFound" };
  }

  const note = parsed.data.note || null;

  const { data: existing } = await supabase
    .from("odontogram_teeth")
    .select("status")
    .eq("patient_id", patientId)
    .eq("fdi_number", parsed.data.fdiNumber)
    .maybeSingle();

  const statusBefore = existing?.status ?? "healthy";

  const { error: upsertError } = await supabase
    .from("odontogram_teeth")
    .upsert(
      {
        clinic_id: profile.clinic_id,
        patient_id: patientId,
        fdi_number: parsed.data.fdiNumber,
        status: parsed.data.status,
        notes: note,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,fdi_number" },
    );

  if (upsertError) {
    return { error: "saveFailed" };
  }

  const { error: eventError } = await supabase.from("odontogram_events").insert({
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    fdi_number: parsed.data.fdiNumber,
    event_type: "status_change",
    status_before: statusBefore,
    status_after: parsed.data.status,
    note,
    recorded_by: user!.id,
  });

  if (eventError) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "odontogram.tooth_updated",
    payload: { patient_id: patientId, fdi_number: parsed.data.fdiNumber },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "toothUpdated" };
}
