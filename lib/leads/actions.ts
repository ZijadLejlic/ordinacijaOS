"use server";

import { sendLeadNotificationEmail } from "@/lib/email/resend";
import {
  getRequestIp,
  hashIp,
  RATE_LIMIT_PER_HOUR,
} from "@/lib/leads/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { submitLeadSchema } from "@/lib/validations/lead";

export type LeadActionState = {
  ok?: boolean;
  error?: "invalid" | "rateLimited" | "failed";
} | null;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitLeadAction(
  _prev: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const honeypot = formString(formData, "website");
  if (honeypot.length > 0) {
    // Silent success for bots — do not insert or email.
    return { ok: true };
  }

  const parsed = submitLeadSchema.safeParse({
    name: formString(formData, "name"),
    clinicName: formString(formData, "clinicName"),
    phone: formString(formData, "phone"),
    email: formString(formData, "email"),
    preferredTime: formString(formData, "preferredTime"),
    message: formString(formData, "message"),
    gdpr: formData.get("gdpr") === "on" ? "on" : "",
    locale: formString(formData, "locale") || "bs",
    sourcePage: formString(formData, "sourcePage") || "contact",
    website: honeypot,
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const data = parsed.data;
  const ip = await getRequestIp();
  const ipHash = ip ? hashIp(ip) : null;

  let service;
  try {
    service = createServiceClient();
  } catch {
    return { error: "failed" };
  }

  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    if (countError) {
      console.error("[leads] rate-limit count failed", countError.message);
      return { error: "failed" };
    }
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return { error: "rateLimited" };
    }
  }

  const email = data.email?.trim() ? data.email.trim() : null;
  const message = data.message?.trim() ? data.message.trim() : null;

  const { data: inserted, error: insertError } = await service
    .from("leads")
    .insert({
      name: data.name,
      clinic_name: data.clinicName,
      phone: data.phone,
      email,
      preferred_time: data.preferredTime,
      message,
      locale: data.locale,
      source_page: data.sourcePage,
      status: "new",
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[leads] insert failed", insertError?.message);
    return { error: "failed" };
  }

  try {
    await sendLeadNotificationEmail({
      leadId: inserted.id,
      name: data.name,
      clinicName: data.clinicName,
      phone: data.phone,
      email,
      preferredTime: data.preferredTime,
      message,
      locale: data.locale,
      sourcePage: data.sourcePage,
    });
  } catch (err) {
    // Lead is already stored — support can follow up from DB.
    console.error(
      "[leads] Resend failed",
      err instanceof Error ? err.message : err,
    );
  }

  return { ok: true };
}
