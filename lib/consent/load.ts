import {
  CONSENT_TEMPLATE_KEYS,
  CONSENT_TEMPLATE_LOCALES,
  type ConsentTemplateKey,
  type ConsentTemplateLocale,
} from "@/lib/consent/templates";
import { createClient } from "@/lib/supabase/server";

export type ConsentFormRow = {
  id: string;
  templateKey: ConsentTemplateKey;
  locale: ConsentTemplateLocale;
  title: string;
  bodyText: string;
};

export type ConsentSignatureRow = {
  id: string;
  templateKey: ConsentTemplateKey;
  locale: ConsentTemplateLocale;
  title: string;
  pdfStoragePath: string;
  signedAt: string;
};

async function ensureForms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
) {
  await supabase.rpc("seed_default_consent_forms", {
    p_clinic_id: clinicId,
  });
}

const KEY_ORDER = CONSENT_TEMPLATE_KEYS as readonly string[];

/** Server-only loader (not a Server Action). */
export async function loadConsentFormsForClinic(
  clinicId: string,
): Promise<ConsentFormRow[]> {
  const supabase = await createClient();
  await ensureForms(supabase, clinicId);

  const { data } = await supabase
    .from("consent_forms")
    .select("id, template_key, locale, title, body_text")
    .eq("clinic_id", clinicId)
    .order("locale", { ascending: true });

  return (data ?? [])
    .filter(
      (row) =>
        KEY_ORDER.includes(row.template_key) &&
        CONSENT_TEMPLATE_LOCALES.includes(
          row.locale as ConsentTemplateLocale,
        ),
    )
    .map((row) => ({
      id: row.id,
      templateKey: row.template_key as ConsentTemplateKey,
      locale: row.locale as ConsentTemplateLocale,
      title: row.title,
      bodyText: row.body_text,
    }))
    .sort((a, b) => {
      const keyDiff =
        KEY_ORDER.indexOf(a.templateKey) - KEY_ORDER.indexOf(b.templateKey);
      if (keyDiff !== 0) return keyDiff;
      return a.locale.localeCompare(b.locale);
    });
}

export async function loadPatientConsentSignatures(
  clinicId: string,
  patientId: string,
): Promise<ConsentSignatureRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consent_signatures")
    .select(
      "id, template_key, locale, title, pdf_storage_path, signed_at",
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("signed_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    templateKey: row.template_key as ConsentTemplateKey,
    locale: row.locale as ConsentTemplateLocale,
    title: row.title,
    pdfStoragePath: row.pdf_storage_path,
    signedAt: row.signed_at,
  }));
}
