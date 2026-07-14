"use server";

import { formatInTimeZone } from "date-fns-tz";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";
import { getClinicWriteBlock } from "@/lib/clinic/writable";
import { renderConsentPdf } from "@/lib/consent/pdf";
import {
  canReadConsentForms,
  canSignConsents,
  canWriteConsentForms,
} from "@/lib/consent/rbac";
import {
  renderConsentTemplate,
  type ConsentTemplateKey,
  type ConsentTemplateLocale,
  type ConsentTemplateVars,
} from "@/lib/consent/templates";
import { assertFeature } from "@/lib/entitlements";
import {
  consentPdfPath,
  consentSignaturePath,
  PATIENT_FILES_BUCKET,
} from "@/lib/patients/storage";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  signConsentSchema,
  updateConsentFormSchema,
} from "@/lib/validations/consent";

export type ConsentActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Database["public"]["Enums"]["app_role"];
  is_active: boolean;
};

async function requireConsentAccess(mode: "read" | "write" | "sign") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null as ProfileRow | null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const ok =
    mode === "write"
      ? canWriteConsentForms(profile.role)
      : mode === "sign"
        ? canSignConsents(profile.role)
        : canReadConsentForms(profile.role);

  if (!ok) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  if (mode === "write" || mode === "sign") {
    const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
    if (writeBlock) {
      return {
        error: writeBlock,
        supabase,
        user,
        profile: profile as ProfileRow,
      };
    }
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

function revalidateConsentSettings(locale: string) {
  revalidatePath(`/${locale}/settings/consent`);
}

function revalidatePatient(locale: string, patientId: string) {
  revalidatePath(`/${locale}/patients/${patientId}`);
}

function normalizeLocale(locale: string): ConsentTemplateLocale {
  return locale === "en" ? "en" : "bs";
}

function parsePngDataUrl(dataUrl: string): Buffer | null {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  try {
    const buf = Buffer.from(dataUrl.slice(prefix.length), "base64");
    if (buf.length < 64 || buf.length > 800_000) return null;
    // PNG magic bytes
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function updateConsentFormAction(
  _prev: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  const parsed = updateConsentFormSchema.safeParse({
    templateKey: formData.get("templateKey"),
    locale: formData.get("locale"),
    title: formData.get("title"),
    bodyText: formData.get("bodyText"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireConsentAccess("write");
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "consent_draw_sign",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  await supabase.rpc("seed_default_consent_forms", {
    p_clinic_id: profile.clinic_id,
  });

  const { data, error } = await supabase
    .from("consent_forms")
    .update({
      title: parsed.data.title,
      body_text: parsed.data.bodyText,
    })
    .eq("clinic_id", profile.clinic_id)
    .eq("template_key", parsed.data.templateKey)
    .eq("locale", parsed.data.locale)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "consent_template.updated",
    payload: {
      template_key: parsed.data.templateKey,
      locale: parsed.data.locale,
    },
  });

  revalidateConsentSettings(locale);
  return { message: "saved" };
}

export async function signConsentAction(
  _prev: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  const parsed = signConsentSchema.safeParse({
    patientId: formData.get("patientId"),
    consentFormId: formData.get("consentFormId"),
    signatureDataUrl: formData.get("signatureDataUrl"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "signatureMustBePng") {
      return { error: "signatureEmpty" };
    }
    return { error: "invalid" };
  }

  const signatureBuffer = parsePngDataUrl(parsed.data.signatureDataUrl);
  if (!signatureBuffer) {
    return { error: "signatureEmpty" };
  }

  const auth = await requireConsentAccess("sign");
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const uiLocale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "consent_draw_sign",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("id", parsed.data.patientId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!patient) {
    return { error: "patientNotFound" };
  }

  const { data: form } = await supabase
    .from("consent_forms")
    .select("id, template_key, locale, title, body_text")
    .eq("id", parsed.data.consentFormId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!form) {
    return { error: "templateNotFound" };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const signedAt = new Date();
  const dateFormatted = formatInTimeZone(
    signedAt,
    CLINIC_TIMEZONE,
    form.locale === "en" ? "dd MMM yyyy" : "dd.MM.yyyy.",
  );

  const vars: ConsentTemplateVars = {
    ime: `${patient.first_name} ${patient.last_name}`.trim(),
    datum: dateFormatted,
    ordinacija: clinic?.name ?? "",
  };

  const bodyRendered = renderConsentTemplate(form.body_text, vars);
  const titleRendered = renderConsentTemplate(form.title, vars);

  const signatureId = crypto.randomUUID();
  const sigPath = consentSignaturePath(
    profile.clinic_id,
    patient.id,
    signatureId,
  );
  const pdfPath = consentPdfPath(profile.clinic_id, patient.id, signatureId);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderConsentPdf({
      clinicName: clinic?.name ?? "",
      patientName: vars.ime,
      title: titleRendered,
      bodyText: bodyRendered,
      signaturePngDataUrl: parsed.data.signatureDataUrl,
      signedAt: formatInTimeZone(
        signedAt,
        CLINIC_TIMEZONE,
        form.locale === "en" ? "dd MMM yyyy HH:mm" : "dd.MM.yyyy. HH:mm",
      ),
      locale: form.locale,
    });
  } catch {
    return { error: "pdfFailed" };
  }

  const { data: row, error: insertError } = await supabase
    .from("consent_signatures")
    .insert({
      id: signatureId,
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      consent_form_id: form.id,
      template_key: form.template_key as ConsentTemplateKey,
      locale: form.locale as ConsentTemplateLocale,
      title: titleRendered,
      body_rendered: bodyRendered,
      signature_storage_path: sigPath,
      pdf_storage_path: pdfPath,
      signed_at: signedAt.toISOString(),
      signed_by: user!.id,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { error: "signFailed" };
  }

  const { error: sigUploadError } = await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(sigPath, signatureBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (sigUploadError) {
    await supabase.from("consent_signatures").delete().eq("id", row.id);
    return { error: "signFailed" };
  }

  const { error: pdfUploadError } = await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (pdfUploadError) {
    await supabase.storage.from(PATIENT_FILES_BUCKET).remove([sigPath]);
    await supabase.from("consent_signatures").delete().eq("id", row.id);
    return { error: "signFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "consent.signed",
    payload: {
      patient_id: patient.id,
      template_key: form.template_key,
      locale: form.locale,
      consent_signature_id: row.id,
    },
  });

  revalidatePatient(normalizeLocale(uiLocale), patient.id);
  return { message: "signed" };
}

export async function deleteConsentSignatureAction(
  patientId: string,
  signatureId: string,
): Promise<ConsentActionState> {
  const auth = await requireConsentAccess("sign");
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "consent_draw_sign",
  );
  if (!feature.ok) {
    return { error: feature.code };
  }

  const { data: row } = await supabase
    .from("consent_signatures")
    .select("id, signature_storage_path, pdf_storage_path, template_key")
    .eq("id", signatureId)
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!row) {
    return { error: "notFound" };
  }

  await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .remove([row.signature_storage_path, row.pdf_storage_path]);

  const { error } = await supabase
    .from("consent_signatures")
    .delete()
    .eq("id", row.id);

  if (error) {
    return { error: "deleteFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "consent.deleted",
    payload: {
      patient_id: patientId,
      template_key: row.template_key,
      consent_signature_id: row.id,
    },
  });

  revalidatePatient(locale, patientId);
  return { message: "deleted" };
}
