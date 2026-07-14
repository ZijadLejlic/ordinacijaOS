"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { getClinicWriteBlock } from "@/lib/clinic/writable";
import { isCrmKind, type CrmKind } from "@/lib/crm/constants";
import { canAccessCrm, canSendCrmMessages } from "@/lib/crm/rbac";
import { sendTemplatedEmail } from "@/lib/email/resend";
import {
  bodyTextToHtml,
  renderEmailSubject,
  type TemplateVars,
} from "@/lib/email/templates";
import { assertFeature } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  dismissCrmNotificationSchema,
  sendCrmNotificationSchema,
} from "@/lib/validations/crm";
import type { Database } from "@/lib/supabase/database.types";

export type CrmActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Database["public"]["Enums"]["app_role"];
  is_active: boolean;
};

async function requireCrmAccess(mode: "read" | "send") {
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
    mode === "send"
      ? canSendCrmMessages(profile.role)
      : canAccessCrm(profile.role);

  if (!ok) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  if (mode === "send") {
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

function revalidateCrm(locale: string) {
  revalidatePath(`/${locale}/crm`);
  revalidatePath(`/${locale}/dashboard`);
}

function normalizeLocale(locale: string): "bs" | "en" {
  return locale === "en" ? "en" : "bs";
}

function emptyVars(overrides: Partial<TemplateVars>): TemplateVars {
  return {
    ime: "—",
    datum: "—",
    vrijeme: "—",
    ordinacija: "—",
    doktor: "—",
    usluga: "—",
    ...overrides,
  };
}

export async function sendCrmNotificationAction(
  notificationId: string,
  localeOverride?: string,
): Promise<CrmActionState> {
  const parsed = sendCrmNotificationSchema.safeParse({
    notificationId,
    locale: localeOverride,
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireCrmAccess("send");
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(supabase, profile.clinic_id, "crm_light");
  if (!feature.ok) return { error: "featureDisabled" };

  const appLocale = await getLocale();
  const templateLocale = normalizeLocale(parsed.data.locale ?? appLocale);

  const { data: notification } = await supabase
    .from("crm_notifications")
    .select(
      "id, kind, due_on, status, patient_id, patients(first_name, last_name, email)",
    )
    .eq("id", parsed.data.notificationId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!notification) return { error: "notFound" };
  if (notification.status !== "open") return { error: "notOpen" };
  if (!isCrmKind(notification.kind)) return { error: "invalid" };

  const patient = Array.isArray(notification.patients)
    ? notification.patients[0]
    : notification.patients;

  const to = patient?.email?.trim();
  if (!to) return { error: "patientNoEmail" };

  const kind = notification.kind as CrmKind;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  await supabase.rpc("seed_default_email_templates", {
    p_clinic_id: profile.clinic_id,
  });

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body_text")
    .eq("clinic_id", profile.clinic_id)
    .eq("template_key", kind)
    .eq("locale", templateLocale)
    .maybeSingle();

  if (!template) return { error: "templateNotFound" };

  const dueFormatted = notification.due_on
    .split("-")
    .reverse()
    .join(".")
    .concat(".");

  const vars = emptyVars({
    ime: [patient?.first_name, patient?.last_name].filter(Boolean).join(" "),
    datum: dueFormatted,
    ordinacija: clinic?.name ?? "",
  });

  const subject = renderEmailSubject(template.subject, vars);
  const html = bodyTextToHtml(template.body_text, vars);

  const { data: outbound, error: insertError } = await supabase
    .from("outbound_messages")
    .insert({
      clinic_id: profile.clinic_id,
      channel: "email",
      template_key: kind,
      locale: templateLocale,
      to_address: to,
      subject,
      status: "queued",
      is_test: false,
      patient_id: notification.patient_id,
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

  const { error: updateError } = await supabase
    .from("crm_notifications")
    .update({
      status: "sent",
      outbound_message_id: outbound.id,
      sent_by: user.id,
      sent_at: new Date().toISOString(),
    })
    .eq("id", notification.id)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "open");

  if (updateError) return { error: "sendFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "crm.notification_sent",
    payload: {
      notification_id: notification.id,
      kind,
      patient_id: notification.patient_id,
      outbound_id: outbound.id,
    },
  });

  revalidateCrm(appLocale);
  return { message: "sent" };
}

export async function dismissCrmNotificationAction(
  notificationId: string,
): Promise<CrmActionState> {
  const parsed = dismissCrmNotificationSchema.safeParse({ notificationId });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireCrmAccess("send");
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(supabase, profile.clinic_id, "crm_light");
  if (!feature.ok) return { error: "featureDisabled" };

  const { data: updated, error: updateError } = await supabase
    .from("crm_notifications")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.notificationId)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "open")
    .select("id, kind, patient_id")
    .maybeSingle();

  if (updateError || !updated) return { error: "notFound" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "crm.notification_dismissed",
    payload: {
      notification_id: updated.id,
      kind: updated.kind,
      patient_id: updated.patient_id,
    },
  });

  const locale = await getLocale();
  revalidateCrm(locale);
  return { message: "dismissed" };
}
