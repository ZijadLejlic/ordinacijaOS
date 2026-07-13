import {
  EMAIL_TEMPLATE_LOCALES,
  type EmailTemplateKey,
  type EmailTemplateLocale,
} from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/server";

export type EmailTemplateRow = {
  id: string;
  templateKey: EmailTemplateKey;
  locale: EmailTemplateLocale;
  subject: string;
  bodyText: string;
};

async function ensureTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
) {
  await supabase.rpc("seed_default_email_templates", {
    p_clinic_id: clinicId,
  });
}

/** Server-only loader (not a Server Action). */
export async function loadEmailTemplatesForClinic(
  clinicId: string,
): Promise<EmailTemplateRow[]> {
  const supabase = await createClient();
  await ensureTemplates(supabase, clinicId);

  const { data } = await supabase
    .from("email_templates")
    .select("id, template_key, locale, subject, body_text")
    .eq("clinic_id", clinicId)
    .order("locale", { ascending: true });

  return (data ?? [])
    .filter((row) =>
      EMAIL_TEMPLATE_LOCALES.includes(row.locale as EmailTemplateLocale),
    )
    .map((row) => ({
      id: row.id,
      templateKey: row.template_key as EmailTemplateKey,
      locale: row.locale as EmailTemplateLocale,
      subject: row.subject,
      bodyText: row.body_text,
    }));
}
