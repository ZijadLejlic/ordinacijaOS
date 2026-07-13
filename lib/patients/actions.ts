"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { writeAuditEvent } from "@/lib/audit/log";
import {
  assertCanAddPatientImage,
  assertFeature,
  getClinicLimits,
} from "@/lib/entitlements";
import { canAccessPatients, canWritePatients } from "@/lib/patients/rbac";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  PATIENT_FILES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  convertImageToWebp,
  documentPath,
  imagePath,
} from "@/lib/patients/storage";
import { createClient } from "@/lib/supabase/server";
import {
  createAllergySchema,
  createPatientSchema,
  documentTitleSchema,
  imageTitleSchema,
  updatePatientSchema,
} from "@/lib/validations/patient";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type PatientActionState = {
  error?: string;
  message?: string;
} | null;

async function requireClinicalProfile(allowedRoles: readonly AppRole[]) {
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

  if (!profile?.is_active || !allowedRoles.includes(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile };
}

const WRITE_ROLES = ["owner", "doctor", "assistant", "reception"] as const;
const READ_ROLES = ["owner", "doctor", "assistant", "reception"] as const;

function emptyToUndefined(value: string | undefined) {
  return value === "" ? undefined : value;
}

export async function createPatientAction(
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const parsed = createPatientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    address: formData.get("address") ?? "",
    medicalHistory: formData.get("medicalHistory") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(supabase, profile.clinic_id, "patients_chart");
  if (!feature.ok) {
    return { error: feature.code };
  }

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: profile.clinic_id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: emptyToUndefined(parsed.data.phone) ?? null,
      email: emptyToUndefined(parsed.data.email) ?? null,
      date_of_birth: emptyToUndefined(parsed.data.dateOfBirth) ?? null,
      address: emptyToUndefined(parsed.data.address) ?? null,
      medical_history: emptyToUndefined(parsed.data.medicalHistory) ?? null,
      notes: emptyToUndefined(parsed.data.notes) ?? null,
    })
    .select("id")
    .single();

  if (error || !patient) {
    return { error: "createFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.created",
    payload: { patient_id: patient.id },
  });

  revalidatePath(`/${locale}/patients`);
  redirect({ href: `/patients/${patient.id}`, locale });
  return null;
}

export async function updatePatientAction(
  patientId: string,
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const parsed = updatePatientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    address: formData.get("address") ?? "",
    medicalHistory: formData.get("medicalHistory") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(supabase, profile.clinic_id, "patients_chart");
  if (!feature.ok) {
    return { error: feature.code };
  }

  const { data: updated, error } = await supabase
    .from("patients")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: emptyToUndefined(parsed.data.phone) ?? null,
      email: emptyToUndefined(parsed.data.email) ?? null,
      date_of_birth: emptyToUndefined(parsed.data.dateOfBirth) ?? null,
      address: emptyToUndefined(parsed.data.address) ?? null,
      medical_history: emptyToUndefined(parsed.data.medicalHistory) ?? null,
      notes: emptyToUndefined(parsed.data.notes) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "patientNotFound" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.updated",
    payload: { patient_id: patientId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "patientUpdated" };
}

export async function deactivatePatientAction(
  patientId: string,
): Promise<PatientActionState> {
  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: updated, error } = await supabase
    .from("patients")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "patientNotFound" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.deactivated",
    payload: { patient_id: patientId },
  });

  revalidatePath(`/${locale}/patients`);
  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "patientDeactivated" };
}

export async function addAllergyAction(
  patientId: string,
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const parsed = createAllergySchema.safeParse({
    allergen: formData.get("allergen"),
    severity: formData.get("severity"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(supabase, profile.clinic_id, "patients_chart");
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

  const { error } = await supabase.from("patient_allergies").insert({
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    allergen: parsed.data.allergen,
    severity: parsed.data.severity,
    notes: emptyToUndefined(parsed.data.notes) ?? null,
  });

  if (error) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.allergy_added",
    payload: { patient_id: patientId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "allergyAdded" };
}

export async function deleteAllergyAction(
  allergyId: string,
  patientId: string,
): Promise<PatientActionState> {
  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { error } = await supabase
    .from("patient_allergies")
    .delete()
    .eq("id", allergyId)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.allergy_deleted",
    payload: { patient_id: patientId, allergy_id: allergyId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "allergyDeleted" };
}

export async function uploadDocumentAction(
  patientId: string,
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const parsed = documentTitleSchema.safeParse({
    title: formData.get("title"),
  });
  const file = formData.get("file");

  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    return { error: "invalid" };
  }
  if (file.type !== "application/pdf") {
    return { error: "documentMustBePdf" };
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { error: "documentTooLarge" };
  }

  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(supabase, profile.clinic_id, "patients_chart");
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

  const fileId = crypto.randomUUID();
  const path = documentPath(profile.clinic_id, patientId, fileId);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: docRow, error: insertError } = await supabase
    .from("patient_documents")
    .insert({
      id: fileId,
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      title: parsed.data.title,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user!.id,
    })
    .select("id")
    .single();

  if (insertError || !docRow) {
    return { error: "uploadFailed" };
  }

  const { error: uploadError } = await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    await supabase.from("patient_documents").delete().eq("id", docRow.id);
    return { error: "uploadFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.document_uploaded",
    payload: { patient_id: patientId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "documentUploaded" };
}

export async function deleteDocumentAction(
  documentId: string,
  patientId: string,
): Promise<PatientActionState> {
  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: doc } = await supabase
    .from("patient_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!doc) {
    return { error: "documentNotFound" };
  }

  await supabase.storage.from(PATIENT_FILES_BUCKET).remove([doc.storage_path]);

  const { error } = await supabase
    .from("patient_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.document_deleted",
    payload: { patient_id: patientId, document_id: documentId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "documentDeleted" };
}

export async function uploadImageAction(
  patientId: string,
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const parsed = imageTitleSchema.safeParse({
    title: formData.get("title"),
  });
  const file = formData.get("file");

  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    return { error: "invalid" };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "imageMustBeImage" };
  }

  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(supabase, profile.clinic_id, "patients_chart");
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

  const { count } = await supabase
    .from("patient_images")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  const limits = await getClinicLimits(supabase, profile.clinic_id);
  const imageCheck = assertCanAddPatientImage(limits, count ?? 0);
  if (!imageCheck.ok) {
    return { error: imageCheck.code };
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await convertImageToWebp(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "imageConvertFailed" };
  }

  const fileId = crypto.randomUUID();
  const path = imagePath(profile.clinic_id, patientId, fileId);

  const { data: imgRow, error: insertError } = await supabase
    .from("patient_images")
    .insert({
      id: fileId,
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      title: parsed.data.title,
      storage_path: path,
      mime_type: "image/webp",
      size_bytes: webpBuffer.byteLength,
      uploaded_by: user!.id,
    })
    .select("id")
    .single();

  if (insertError || !imgRow) {
    return { error: "uploadFailed" };
  }

  const { error: uploadError } = await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(path, webpBuffer, { contentType: "image/webp", upsert: false });

  if (uploadError) {
    await supabase.from("patient_images").delete().eq("id", imgRow.id);
    return { error: "uploadFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.image_uploaded",
    payload: { patient_id: patientId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "imageUploaded" };
}

export async function deleteImageAction(
  imageId: string,
  patientId: string,
): Promise<PatientActionState> {
  const auth = await requireClinicalProfile(WRITE_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWritePatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: image } = await supabase
    .from("patient_images")
    .select("id, storage_path")
    .eq("id", imageId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!image) {
    return { error: "imageNotFound" };
  }

  await supabase.storage.from(PATIENT_FILES_BUCKET).remove([image.storage_path]);

  const { error } = await supabase
    .from("patient_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "patient.image_deleted",
    payload: { patient_id: patientId, image_id: imageId },
  });

  revalidatePath(`/${locale}/patients/${patientId}`);
  return { message: "imageDeleted" };
}

export async function createSignedFileUrlAction(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const auth = await requireClinicalProfile(READ_ROLES);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canAccessPatients(auth.profile.role)) {
    return { error: "forbidden" };
  }

  if (!path.startsWith(`${auth.profile.clinic_id}/`)) {
    return { error: "forbidden" };
  }

  const { data, error } = await auth.supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return { error: "signedUrlFailed" };
  }

  return { url: data.signedUrl };
}
