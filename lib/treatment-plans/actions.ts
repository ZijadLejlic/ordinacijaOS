"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { assertFeature } from "@/lib/entitlements";
import { isValidFdi } from "@/lib/odontogram/fdi";
import { canWriteTreatmentPlan } from "@/lib/patients/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  addTreatmentPlanItemSchema,
  createTreatmentPlanSchema,
  updateTreatmentPlanItemStatusSchema,
} from "@/lib/validations/treatment-plan";

export type TreatmentPlanActionState = {
  error?: string;
  message?: string;
} | null;

async function requireTreatmentPlanWriter() {
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

  if (!profile?.is_active || !canWriteTreatmentPlan(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile };
}

async function requireActivePatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string,
) {
  const { data: patient } = await supabase
    .from("patients")
    .select("id, is_active")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "patientNotFound" as const };
  if (!patient.is_active) return { error: "patientInactive" as const };
  return { error: null, patient };
}

function revalidatePatient(locale: string, patientId: string) {
  revalidatePath(`/${locale}/patients/${patientId}`);
}

export async function createTreatmentPlanAction(
  patientId: string,
  _prev: TreatmentPlanActionState,
  formData: FormData,
): Promise<TreatmentPlanActionState> {
  const parsed = createTreatmentPlanSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireTreatmentPlanWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "treatment_plan",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    patientId,
  );
  if (patientCheck.error) {
    return { error: patientCheck.error };
  }

  const { data: plan, error } = await supabase
    .from("treatment_plans")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error || !plan) {
    return { error: "createFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "treatment_plan.created",
    payload: { treatment_plan_id: plan.id, patient_id: patientId },
  });

  revalidatePatient(locale, patientId);
  return { message: "planCreated" };
}

export async function setTreatmentPlanActiveAction(
  patientId: string,
  planId: string,
  isActive: boolean,
): Promise<TreatmentPlanActionState> {
  const auth = await requireTreatmentPlanWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "treatment_plan",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  const { data: updated, error } = await supabase
    .from("treatment_plans")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: isActive
      ? "treatment_plan.activated"
      : "treatment_plan.deactivated",
    payload: { treatment_plan_id: planId, patient_id: patientId },
  });

  revalidatePatient(locale, patientId);
  return { message: isActive ? "planActivated" : "planDeactivated" };
}

export async function addTreatmentPlanItemAction(
  patientId: string,
  planId: string,
  _prev: TreatmentPlanActionState,
  formData: FormData,
): Promise<TreatmentPlanActionState> {
  const parsed = addTreatmentPlanItemSchema.safeParse({
    serviceId: formData.get("serviceId"),
    fdiNumber: formData.get("fdiNumber") ?? "",
    estimatedPriceEur: formData.get("estimatedPriceEur"),
    notes: formData.get("notes") ?? "",
    status: formData.get("status") || "planned",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const fdi = parsed.data.fdiNumber;
  if (fdi !== null && !isValidFdi(fdi)) {
    return { error: "invalid" };
  }

  const auth = await requireTreatmentPlanWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "treatment_plan",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    patientId,
  );
  if (patientCheck.error) {
    return { error: patientCheck.error };
  }

  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id, is_active")
    .eq("id", planId)
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!plan) {
    return { error: "planNotFound" };
  }
  if (!plan.is_active) {
    return { error: "planInactive" };
  }

  const { data: service } = await supabase
    .from("services")
    .select("id, name, price_eur, is_active")
    .eq("id", parsed.data.serviceId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!service || !service.is_active) {
    return { error: "serviceNotFound" };
  }

  const { data: maxSort } = await supabase
    .from("treatment_plan_items")
    .select("sort_order")
    .eq("treatment_plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: item, error } = await supabase
    .from("treatment_plan_items")
    .insert({
      clinic_id: profile.clinic_id,
      treatment_plan_id: planId,
      service_id: service.id,
      service_name: service.name,
      fdi_number: fdi,
      estimated_price_eur: parsed.data.estimatedPriceEur,
      notes: parsed.data.notes || null,
      status: parsed.data.status ?? "planned",
      sort_order: (maxSort?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !item) {
    return { error: "createFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "treatment_plan.item_added",
    payload: {
      treatment_plan_id: planId,
      item_id: item.id,
      patient_id: patientId,
    },
  });

  revalidatePatient(locale, patientId);
  return { message: "itemAdded" };
}

export async function updateTreatmentPlanItemStatusAction(
  patientId: string,
  itemId: string,
  status: string,
): Promise<TreatmentPlanActionState> {
  const parsed = updateTreatmentPlanItemStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireTreatmentPlanWriter();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "treatment_plan",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  const patientCheck = await requireActivePatient(
    supabase,
    profile.clinic_id,
    patientId,
  );
  if (patientCheck.error) {
    return { error: patientCheck.error };
  }

  const { data: updated, error } = await supabase
    .from("treatment_plan_items")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("clinic_id", profile.clinic_id)
    .select("id, treatment_plan_id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "saveFailed" };
  }

  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("id", updated.treatment_plan_id)
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!plan) {
    return { error: "planNotFound" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "treatment_plan.item_status_updated",
    payload: {
      treatment_plan_id: updated.treatment_plan_id,
      item_id: itemId,
      status: parsed.data.status,
      patient_id: patientId,
    },
  });

  revalidatePatient(locale, patientId);
  return { message: "itemUpdated" };
}
