"use server";

import { formatInTimeZone } from "date-fns-tz";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { getClinicWriteBlock } from "@/lib/clinic/writable";
import { sendTemplatedEmail } from "@/lib/email/resend";
import {
  canReadEmailTemplates,
  canSendEmailReminders,
  canWriteEmailTemplates,
} from "@/lib/email/rbac";
import {
  bodyTextToHtml,
  renderEmailSubject,
  SAMPLE_TEMPLATE_VARS,
  type EmailTemplateKey,
  type EmailTemplateLocale,
  type TemplateVars,
} from "@/lib/email/templates";
import { assertFeature } from "@/lib/entitlements";
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";
import {
  sendAppointmentReminderSchema,
  sendTestEmailSchema,
  updateEmailTemplateSchema,
} from "@/lib/validations/email-template";
import type { Database } from "@/lib/supabase/database.types";

export type EmailActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Database["public"]["Enums"]["app_role"];
  is_active: boolean;
};

async function requireEmailAccess(
  mode: "read" | "write" | "send",
) {
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
      ? canWriteEmailTemplates(profile.role)
      : mode === "send"
        ? canSendEmailReminders(profile.role)
        : canReadEmailTemplates(profile.role);

  if (!ok) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  if (mode === "write" || mode === "send") {
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

function revalidateEmail(locale: string) {
  revalidatePath(`/${locale}/settings/email`);
  revalidatePath(`/${locale}/calendar`);
}

function normalizeLocale(locale: string): EmailTemplateLocale {
  return locale === "en" ? "en" : "bs";
}

async function ensureTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
) {
  const { error } = await supabase.rpc("seed_default_email_templates", {
    p_clinic_id: clinicId,
  });
  return { error };
}

export async function updateEmailTemplateAction(
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  const parsed = updateEmailTemplateSchema.safeParse({
    templateKey: formData.get("templateKey") ?? "",
    locale: formData.get("locale") ?? "",
    subject: formData.get("subject") ?? "",
    bodyText: formData.get("bodyText") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireEmailAccess("write");
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "email_reminders",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  await ensureTemplates(supabase, profile.clinic_id);

  const { data: updated, error: updateError } = await supabase
    .from("email_templates")
    .update({
      subject: parsed.data.subject,
      body_text: parsed.data.bodyText,
    })
    .eq("clinic_id", profile.clinic_id)
    .eq("template_key", parsed.data.templateKey)
    .eq("locale", parsed.data.locale)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "email_template.updated",
    payload: {
      template_key: parsed.data.templateKey,
      locale: parsed.data.locale,
    },
  });

  const locale = await getLocale();
  revalidateEmail(locale);
  return { message: "saved" };
}

export async function sendTestEmailAction(
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  const parsed = sendTestEmailSchema.safeParse({
    templateKey: formData.get("templateKey") ?? "",
    locale: formData.get("locale") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireEmailAccess("send");
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "email_reminders",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const to = user.email?.trim();
  if (!to) return { error: "missingActorEmail" };

  await ensureTemplates(supabase, profile.clinic_id);

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body_text")
    .eq("clinic_id", profile.clinic_id)
    .eq("template_key", parsed.data.templateKey)
    .eq("locale", parsed.data.locale)
    .maybeSingle();

  if (!template) return { error: "templateNotFound" };

  const vars: TemplateVars = {
    ...SAMPLE_TEMPLATE_VARS,
    ordinacija: clinic?.name ?? SAMPLE_TEMPLATE_VARS.ordinacija,
  };

  const subject = `[TEST] ${renderEmailSubject(template.subject, vars)}`;
  const html = bodyTextToHtml(template.body_text, vars);

  const { data: outbound, error: insertError } = await supabase
    .from("outbound_messages")
    .insert({
      clinic_id: profile.clinic_id,
      channel: "email",
      template_key: parsed.data.templateKey,
      locale: parsed.data.locale,
      to_address: to,
      subject,
      status: "queued",
      is_test: true,
      sent_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !outbound) return { error: "sendFailed" };

  try {
    const result = await sendTemplatedEmail({ to, subject, html });
    await supabase
      .from("outbound_messages")
      .update({
        status: "sent",
        provider_message_id: result.id,
        sent_at: new Date().toISOString(),
      })
      .eq("id", outbound.id);
  } catch {
    await supabase
      .from("outbound_messages")
      .update({
        status: "failed",
        error_message: "provider_error",
      })
      .eq("id", outbound.id);
    return { error: "sendFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "email.test_sent",
    payload: {
      template_key: parsed.data.templateKey,
      locale: parsed.data.locale,
      outbound_id: outbound.id,
    },
  });

  const locale = await getLocale();
  revalidateEmail(locale);
  return { message: "testSent" };
}

export async function sendAppointmentReminderAction(
  appointmentId: string,
  localeOverride?: string,
): Promise<EmailActionState> {
  const parsed = sendAppointmentReminderSchema.safeParse({
    appointmentId,
    locale: localeOverride,
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireEmailAccess("send");
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "email_reminders",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const appLocale = await getLocale();
  const templateLocale = normalizeLocale(
    parsed.data.locale ?? appLocale,
  );

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, doctor_id, service_id, starts_at, status, patients(first_name, last_name, email), services(name)",
    )
    .eq("id", parsed.data.appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!appointment) return { error: "appointmentNotFound" };
  if (
    appointment.status === "cancelled" ||
    appointment.status === "no_show"
  ) {
    return { error: "appointmentNotSendable" };
  }

  const patient = Array.isArray(appointment.patients)
    ? appointment.patients[0]
    : appointment.patients;
  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;

  const to = patient?.email?.trim();
  if (!to) return { error: "patientNoEmail" };

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const { data: doctor } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", appointment.doctor_id)
    .maybeSingle();

  await ensureTemplates(supabase, profile.clinic_id);

  const templateKey: EmailTemplateKey = "appointment_reminder";
  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body_text")
    .eq("clinic_id", profile.clinic_id)
    .eq("template_key", templateKey)
    .eq("locale", templateLocale)
    .maybeSingle();

  if (!template) return { error: "templateNotFound" };

  const startsAt = new Date(appointment.starts_at);
  const vars: TemplateVars = {
    ime: [patient?.first_name, patient?.last_name].filter(Boolean).join(" "),
    datum: formatInTimeZone(startsAt, CLINIC_TIMEZONE, "dd.MM.yyyy."),
    vrijeme: formatInTimeZone(startsAt, CLINIC_TIMEZONE, "HH:mm"),
    ordinacija: clinic?.name ?? "",
    doktor: doctor?.full_name ?? "",
    usluga: service?.name ?? "—",
  };

  const subject = renderEmailSubject(template.subject, vars);
  const html = bodyTextToHtml(template.body_text, vars);

  const { data: outbound, error: insertError } = await supabase
    .from("outbound_messages")
    .insert({
      clinic_id: profile.clinic_id,
      channel: "email",
      template_key: templateKey,
      locale: templateLocale,
      to_address: to,
      subject,
      status: "queued",
      is_test: false,
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      sent_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !outbound) return { error: "sendFailed" };

  try {
    const result = await sendTemplatedEmail({ to, subject, html });
    await supabase
      .from("outbound_messages")
      .update({
        status: "sent",
        provider_message_id: result.id,
        sent_at: new Date().toISOString(),
      })
      .eq("id", outbound.id);
  } catch {
    await supabase
      .from("outbound_messages")
      .update({
        status: "failed",
        error_message: "provider_error",
      })
      .eq("id", outbound.id);
    return { error: "sendFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "email.reminder_sent",
    payload: {
      template_key: templateKey,
      locale: templateLocale,
      appointment_id: appointment.id,
      outbound_id: outbound.id,
    },
  });

  revalidateEmail(appLocale);
  return { message: "reminderSent" };
}
