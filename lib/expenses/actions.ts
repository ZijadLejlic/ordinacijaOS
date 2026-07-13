"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { assertFeature } from "@/lib/entitlements";
import { canWriteExpenses } from "@/lib/expenses/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  createExpenseSchema,
  updateExpenseSchema,
  voidExpenseSchema,
} from "@/lib/validations/expense";

export type ExpenseActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Parameters<typeof canWriteExpenses>[0];
  is_active: boolean;
};

async function requireExpenseWriter() {
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

  if (!profile?.is_active || !canWriteExpenses(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

function revalidateExpenses(locale: string) {
  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const parsed = createExpenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    vendor: formData.get("vendor") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireExpenseWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "expenses_reports_excel",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const { data, error: insertError } = await supabase
    .from("expenses")
    .insert({
      clinic_id: profile.clinic_id,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      expense_date: parsed.data.expenseDate,
      vendor: parsed.data.vendor,
      notes: parsed.data.notes,
      recorded_by: profile.id,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !data) return { error: "createFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "expense.created",
    payload: {
      expense_id: data.id,
      category: parsed.data.category,
      amount: parsed.data.amount,
    },
  });

  const locale = await getLocale();
  revalidateExpenses(locale);
  return { message: "created" };
}

export async function updateExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    vendor: formData.get("vendor") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireExpenseWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "expenses_reports_excel",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const { data: existing } = await supabase
    .from("expenses")
    .select("id, voided_at")
    .eq("id", parsed.data.expenseId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "expenseNotFound" };
  if (existing.voided_at) return { error: "alreadyVoid" };

  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      expense_date: parsed.data.expenseDate,
      vendor: parsed.data.vendor,
      notes: parsed.data.notes,
    })
    .eq("id", parsed.data.expenseId)
    .eq("clinic_id", profile.clinic_id);

  if (updateError) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "expense.updated",
    payload: { expense_id: parsed.data.expenseId },
  });

  const locale = await getLocale();
  revalidateExpenses(locale);
  return { message: "saved" };
}

export async function voidExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const parsed = voidExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireExpenseWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "expenses_reports_excel",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const { data: existing } = await supabase
    .from("expenses")
    .select("id, voided_at")
    .eq("id", parsed.data.expenseId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "expenseNotFound" };
  if (existing.voided_at) return { error: "alreadyVoid" };

  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      voided_at: new Date().toISOString(),
      voided_reason: parsed.data.reason,
    })
    .eq("id", parsed.data.expenseId)
    .eq("clinic_id", profile.clinic_id);

  if (updateError) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "expense.voided",
    payload: { expense_id: parsed.data.expenseId },
  });

  const locale = await getLocale();
  revalidateExpenses(locale);
  return { message: "voided" };
}
