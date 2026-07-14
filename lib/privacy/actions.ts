"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import {
  deletePatientStorageObjects,
  listPatientStoragePaths,
} from "@/lib/privacy/export";
import {
  canManagePrivacy,
  canRequestPatientErasure,
} from "@/lib/privacy/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type PrivacyActionState = {
  error?: string;
  message?: string;
} | null;

async function requireClinicProfile() {
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

  if (!profile?.is_active) {
    return {
      error: "forbidden" as const,
      supabase,
      user,
      profile: null,
    };
  }

  return { error: null, supabase, user, profile };
}

export async function requestPatientErasureAction(
  patientId: string,
): Promise<PrivacyActionState> {
  const auth = await requireClinicProfile();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canRequestPatientErasure(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, email, phone")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!patient) {
    return { error: "patientNotFound" };
  }

  const snapshot = {
    id: patient.id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    email: patient.email,
    phone: patient.phone,
  } satisfies Record<string, string | null>;

  const { data: created, error } = await supabase
    .from("gdpr_erasure_requests")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      patient_snapshot: snapshot as Json,
      requested_by: user.id,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    if (error?.code === "23505") {
      return { error: "alreadyPending" };
    }
    return { error: "requestFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "gdpr.erasure_requested",
    payload: { request_id: created.id, patient_id: patient.id },
  });

  revalidatePath(`/${locale}/settings/privacy`);
  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "erasureRequested" };
}

export async function rejectPatientErasureAction(
  requestId: string,
  formData: FormData,
): Promise<PrivacyActionState> {
  const auth = await requireClinicProfile();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canManagePrivacy(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: updated, error } = await supabase
    .from("gdpr_erasure_requests")
    .update({
      status: "rejected",
      rejection_reason: reason || null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending")
    .select("id, patient_id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "notFound" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "gdpr.erasure_rejected",
    payload: {
      request_id: updated.id,
      patient_id: updated.patient_id,
      reason: reason || null,
    },
  });

  revalidatePath(`/${locale}/settings/privacy`);
  return { message: "erasureRejected" };
}

export async function approvePatientErasureAction(
  requestId: string,
): Promise<PrivacyActionState> {
  const auth = await requireClinicProfile();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canManagePrivacy(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, profile } = auth;
  const locale = await getLocale();

  const { data: request } = await supabase
    .from("gdpr_erasure_requests")
    .select("id, patient_id, status")
    .eq("id", requestId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!request || request.status !== "pending" || !request.patient_id) {
    return { error: "notFound" };
  }

  try {
    const paths = await listPatientStoragePaths(
      supabase,
      profile.clinic_id,
      request.patient_id,
    );

    const { error: rpcError } = await supabase.rpc(
      "approve_gdpr_patient_erasure",
      { p_request_id: requestId },
    );

    if (rpcError) {
      const msg = rpcError.message ?? "";
      if (msg.includes("mfa_required")) return { error: "mfaRequired" };
      if (msg.includes("not_pending")) return { error: "notFound" };
      if (msg.includes("forbidden")) return { error: "forbidden" };

      await supabase
        .from("gdpr_erasure_requests")
        .update({
          status: "failed",
          error_message: msg.slice(0, 500),
        })
        .eq("id", requestId)
        .eq("clinic_id", profile.clinic_id)
        .eq("status", "pending");

      revalidatePath(`/${locale}/settings/privacy`);
      return { error: "eraseFailed" };
    }

    try {
      await deletePatientStorageObjects(supabase, paths);
    } catch {
      // DB row already gone; orphaned storage is cleaned best-effort.
    }
  } catch {
    revalidatePath(`/${locale}/settings/privacy`);
    return { error: "eraseFailed" };
  }

  revalidatePath(`/${locale}/settings/privacy`);
  revalidatePath(`/${locale}/patients`);
  revalidatePath(`/${locale}/settings/audit`);
  return { message: "erasureCompleted" };
}
