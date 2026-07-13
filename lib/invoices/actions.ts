"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditEvent } from "@/lib/audit/log";
import {
  parseBrandingJson,
  type ClinicBranding,
} from "@/lib/branding/parse";
import { CLINIC_BRANDING_BUCKET } from "@/lib/branding/storage";
import { assertFeature, clinicHasFeature } from "@/lib/entitlements";
import { canWriteInvoices } from "@/lib/invoices/rbac";
import {
  formatInvoiceNumber,
  invoiceStoragePath,
  lineNetFromGross,
  lineVatFromGross,
  roundMoney,
} from "@/lib/invoices/money";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { PATIENT_FILES_BUCKET } from "@/lib/patients/storage";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  cancelPaymentPlanSchema,
  createInvoiceSchema,
  createPaymentPlanSchema,
  invoiceLineInputSchema,
  recordPaymentSchema,
  updateInvoiceLegalSettingsSchema,
  voidInvoiceSchema,
  type InvoiceLineInput,
} from "@/lib/validations/invoice";

/** Prefer storage logo as data URI so PDF does not depend on signed URL TTL. */
async function resolveInvoiceLogoUrl(
  supabase: SupabaseClient<Database>,
  branding: ClinicBranding,
): Promise<string | null> {
  if (branding.logoPath) {
    const { data, error } = await supabase.storage
      .from(CLINIC_BRANDING_BUCKET)
      .download(branding.logoPath);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      return `data:image/webp;base64,${buffer.toString("base64")}`;
    }
  }
  return branding.logoUrl;
}

export type InvoiceActionState = {
  error?: string;
  message?: string;
  invoiceId?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Parameters<typeof canWriteInvoices>[0];
  is_active: boolean;
};

async function requireInvoiceWriter() {
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

  if (!profile?.is_active || !canWriteInvoices(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

function revalidateInvoices(locale: string, invoiceId?: string) {
  revalidatePath(`/${locale}/invoices`);
  revalidatePath(`/${locale}/dashboard`);
  if (invoiceId) {
    revalidatePath(`/${locale}/invoices/${invoiceId}`);
  }
}

function parseLines(raw: string): { lines?: InvoiceLineInput[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "invalid" };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: "linesRequired" };
  }
  const lines: InvoiceLineInput[] = [];
  for (const item of parsed) {
    const result = invoiceLineInputSchema.safeParse(item);
    if (!result.success) return { error: "invalid" };
    lines.push(result.data);
  }
  return { lines };
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function createInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = createInvoiceSchema.safeParse({
    patientId: formData.get("patientId"),
    locationId: formData.get("locationId") ?? "",
    doctorId: formData.get("doctorId") ?? "",
    notes: formData.get("notes") ?? "",
    linesJson: formData.get("linesJson"),
  });
  if (!parsed.success) return { error: "invalid" };

  const linesResult = parseLines(parsed.data.linesJson);
  if (linesResult.error || !linesResult.lines) {
    return { error: linesResult.error ?? "invalid" };
  }

  const auth = await requireInvoiceWriter();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }
  const { supabase, profile, user } = auth;

  const feature = await assertFeature(supabase, profile.clinic_id, "invoices");
  if (!feature.ok) return { error: feature.code };

  const { data: patientRows, error: patientLookupError } = await supabase.rpc(
    "get_patient_for_invoice",
    { p_patient_id: parsed.data.patientId },
  );
  const patient = patientRows?.[0];
  if (patientLookupError || !patient) return { error: "patientNotFound" };
  if (!patient.is_active) return { error: "patientInactive" };

  if (parsed.data.locationId) {
    const { data: loc } = await supabase
      .from("clinic_locations")
      .select("id")
      .eq("id", parsed.data.locationId)
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();
    if (!loc) return { error: "invalid" };
  }

  if (parsed.data.doctorId) {
    const { data: doctor } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", parsed.data.doctorId)
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();
    if (!doctor?.is_active || doctor.role !== "doctor") {
      return { error: "invalid" };
    }
  }

  let subtotal = 0;
  let vatTotal = 0;
  let grandTotal = 0;
  const prepared = linesResult.lines.map((line, index) => {
    const lineTotal = roundMoney(line.quantity * line.unitPrice);
    const vat = lineVatFromGross(lineTotal, line.vatRate);
    const net = lineNetFromGross(lineTotal, line.vatRate);
    subtotal = roundMoney(subtotal + net);
    vatTotal = roundMoney(vatTotal + vat);
    grandTotal = roundMoney(grandTotal + lineTotal);
    return {
      ...line,
      lineTotal,
      sortOrder: index,
    };
  });

  const { data: numberRows, error: numberError } = await supabase.rpc(
    "allocate_invoice_number",
    { p_clinic_id: profile.clinic_id },
  );
  if (numberError || !numberRows?.[0]) {
    return { error: "createFailed" };
  }
  const { series_year: seriesYear, series_number: seriesNumber } =
    numberRows[0];

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      location_id: parsed.data.locationId,
      doctor_id: parsed.data.doctorId,
      series_year: seriesYear,
      series_number: seriesNumber,
      status: "unpaid",
      subtotal_amount: subtotal,
      vat_amount: vatTotal,
      total_amount: grandTotal,
      currency: "EUR",
      notes: parsed.data.notes,
      issued_by: profile.id,
    })
    .select("id, issued_at")
    .single();

  if (invoiceError || !invoice) {
    return { error: "createFailed" };
  }

  const { error: linesError } = await supabase.from("invoice_lines").insert(
    prepared.map((line) => ({
      clinic_id: profile.clinic_id,
      invoice_id: invoice.id,
      service_id: line.serviceId,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      vat_rate: line.vatRate,
      line_total: line.lineTotal,
      sort_order: line.sortOrder,
    })),
  );

  if (linesError) {
    await supabase
      .from("invoices")
      .update({
        status: "void",
        voided_at: new Date().toISOString(),
        voided_reason: "line_insert_failed",
      })
      .eq("id", invoice.id)
      .eq("clinic_id", profile.clinic_id);
    return { error: "createFailed" };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, branding_json, settings_json")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const settings = (clinic?.settings_json ?? {}) as Record<string, unknown>;
  const branding = parseBrandingJson(clinic?.branding_json);
  const logoUrl = await resolveInvoiceLogoUrl(supabase, branding);
  const legalName =
    typeof settings.legal_name === "string" ? settings.legal_name : null;
  const taxId = typeof settings.tax_id === "string" ? settings.tax_id : null;

  const locale = await getLocale();
  const patientName = `${patient.first_name} ${patient.last_name}`.trim();

  try {
    const pdfBuffer = await renderInvoicePdf({
      clinicName: clinic?.name ?? "Ordinacija",
      legalName,
      taxId,
      logoUrl,
      patientName,
      seriesYear,
      seriesNumber,
      issuedAt: invoice.issued_at,
      currency: "EUR",
      subtotalAmount: subtotal,
      vatAmount: vatTotal,
      totalAmount: grandTotal,
      notes: parsed.data.notes,
      lines: prepared.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        lineTotal: l.lineTotal,
      })),
      locale,
    });

    const path = invoiceStoragePath(
      profile.clinic_id,
      patient.id,
      invoice.id,
    );
    const { error: uploadError } = await supabase.storage
      .from(PATIENT_FILES_BUCKET)
      .upload(path, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (!uploadError) {
      await supabase
        .from("invoices")
        .update({ pdf_storage_path: path })
        .eq("id", invoice.id)
        .eq("clinic_id", profile.clinic_id);
    }
  } catch {
    // Invoice stays valid even if PDF generation fails; download can retry later.
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "invoice.created",
    payload: {
      invoice_id: invoice.id,
      patient_id: patient.id,
      series: formatInvoiceNumber(seriesYear, seriesNumber),
      total_amount: grandTotal,
    },
  });

  revalidateInvoices(locale, invoice.id);
  return { message: "created", invoiceId: invoice.id };
}

export async function voidInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = voidInvoiceSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireInvoiceWriter();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }
  const { supabase, profile, user } = auth;

  const feature = await assertFeature(supabase, profile.clinic_id, "invoices");
  if (!feature.ok) return { error: feature.code };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", parsed.data.invoiceId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!invoice) return { error: "invoiceNotFound" };
  if (invoice.status === "void") return { error: "alreadyVoid" };

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "void",
      voided_at: new Date().toISOString(),
      voided_reason: parsed.data.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "invoice.voided",
    payload: {
      invoice_id: invoice.id,
      reason: parsed.data.reason,
    },
  });

  const locale = await getLocale();
  revalidateInvoices(locale, invoice.id);
  return { message: "voided" };
}

export async function recordPaymentAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidAt: formData.get("paidAt") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireInvoiceWriter();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }
  const { supabase, profile, user } = auth;

  const feature = await assertFeature(supabase, profile.clinic_id, "invoices");
  if (!feature.ok) return { error: feature.code };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, total_amount")
    .eq("id", parsed.data.invoiceId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!invoice) return { error: "invoiceNotFound" };
  if (invoice.status === "void") return { error: "invoiceVoid" };

  const { data: existingPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoice.id)
    .eq("clinic_id", profile.clinic_id);

  const paidSoFar = roundMoney(
    (existingPayments ?? []).reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    ),
  );
  const remaining = roundMoney(Number(invoice.total_amount) - paidSoFar);
  if (parsed.data.amount > remaining + 0.001) {
    return { error: "overpayment" };
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      clinic_id: profile.clinic_id,
      invoice_id: invoice.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      paid_at: parsed.data.paidAt ?? new Date().toISOString(),
      note: parsed.data.note,
      recorded_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !payment) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "payment.recorded",
    payload: {
      payment_id: payment.id,
      invoice_id: invoice.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
    },
  });

  const locale = await getLocale();
  revalidateInvoices(locale, invoice.id);
  return { message: "paymentRecorded" };
}

export async function createPaymentPlanAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = createPaymentPlanSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    installmentCount: formData.get("installmentCount"),
    firstDueDate: formData.get("firstDueDate"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireInvoiceWriter();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }
  const { supabase, profile, user } = auth;

  const invoicesFeature = await assertFeature(
    supabase,
    profile.clinic_id,
    "invoices",
  );
  if (!invoicesFeature.ok) return { error: invoicesFeature.code };

  const hasInstallments = await clinicHasFeature(
    supabase,
    profile.clinic_id,
    "installments_calculator",
  );
  if (!hasInstallments) return { error: "featureDisabled" };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, patient_id, status, total_amount")
    .eq("id", parsed.data.invoiceId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!invoice) return { error: "invoiceNotFound" };
  if (invoice.status === "void" || invoice.status === "paid") {
    return { error: "planNotAllowed" };
  }

  const { data: existingPlan } = await supabase
    .from("payment_plans")
    .select("id")
    .eq("invoice_id", invoice.id)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "active")
    .maybeSingle();

  if (existingPlan) return { error: "planExists" };

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoice.id)
    .eq("clinic_id", profile.clinic_id);

  const paid = roundMoney(
    (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
  );
  const remaining = roundMoney(Number(invoice.total_amount) - paid);
  if (remaining <= 0) return { error: "planNotAllowed" };

  const count = parsed.data.installmentCount;
  const base = roundMoney(Math.floor((remaining / count) * 100) / 100);
  const amounts: number[] = Array.from({ length: count }, () => base);
  const allocated = roundMoney(base * count);
  const diff = roundMoney(remaining - allocated);
  amounts[count - 1] = roundMoney(amounts[count - 1] + diff);

  const { data: plan, error: planError } = await supabase
    .from("payment_plans")
    .insert({
      clinic_id: profile.clinic_id,
      invoice_id: invoice.id,
      patient_id: invoice.patient_id,
      total_amount: remaining,
      installment_count: count,
      status: "active",
      notes: parsed.data.notes,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (planError || !plan) return { error: "saveFailed" };

  const { error: installmentsError } = await supabase
    .from("payment_plan_installments")
    .insert(
      amounts.map((amount, index) => ({
        clinic_id: profile.clinic_id,
        payment_plan_id: plan.id,
        sequence_number: index + 1,
        due_date: addMonths(parsed.data.firstDueDate, index),
        amount,
        status: "pending" as const,
      })),
    );

  if (installmentsError) {
    await supabase
      .from("payment_plans")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "payment_plan.created",
    payload: {
      payment_plan_id: plan.id,
      invoice_id: invoice.id,
      installment_count: count,
      total_amount: remaining,
    },
  });

  const locale = await getLocale();
  revalidateInvoices(locale, invoice.id);
  return { message: "planCreated" };
}

export async function cancelPaymentPlanAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = cancelPaymentPlanSchema.safeParse({
    paymentPlanId: formData.get("paymentPlanId"),
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireInvoiceWriter();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }
  const { supabase, profile, user } = auth;

  const hasInstallments = await clinicHasFeature(
    supabase,
    profile.clinic_id,
    "installments_calculator",
  );
  if (!hasInstallments) return { error: "featureDisabled" };

  const { data: plan } = await supabase
    .from("payment_plans")
    .select("id, invoice_id, status")
    .eq("id", parsed.data.paymentPlanId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!plan) return { error: "planNotFound" };
  if (plan.status !== "active") return { error: "planNotActive" };

  const { error } = await supabase
    .from("payment_plans")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", plan.id);

  if (error) return { error: "saveFailed" };

  await supabase
    .from("payment_plan_installments")
    .update({ status: "cancelled" })
    .eq("payment_plan_id", plan.id)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending");

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "payment_plan.cancelled",
    payload: { payment_plan_id: plan.id, invoice_id: plan.invoice_id },
  });

  const locale = await getLocale();
  revalidateInvoices(locale, plan.invoice_id);
  return { message: "planCancelled" };
}

export async function updateInvoiceLegalSettingsAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const parsed = updateInvoiceLegalSettingsSchema.safeParse({
    legalName: formData.get("legalName") ?? "",
    taxId: formData.get("taxId") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireInvoiceWriter();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }
  const { supabase, profile, user } = auth;

  if (profile.role !== "owner") return { error: "forbidden" };

  const { data: clinic } = await supabase
    .from("clinics")
    .select("settings_json")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const current = (clinic?.settings_json ?? {}) as Record<string, unknown>;
  const next: Json = {
    ...current,
    legal_name: parsed.data.legalName,
    tax_id: parsed.data.taxId,
  };

  const { error } = await supabase
    .from("clinics")
    .update({ settings_json: next })
    .eq("id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "invoice.settings_updated",
    payload: { has_legal_name: Boolean(parsed.data.legalName) },
  });

  const locale = await getLocale();
  revalidateInvoices(locale);
  return { message: "settingsSaved" };
}
