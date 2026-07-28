import { getTranslations, setRequestLocale } from "next-intl/server";
import { addMonths, format, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CreateExpenseForm,
  ExcelExportLink,
  ExpenseSearchForm,
  ExpensesTable,
  type ExpenseRow,
} from "@/components/expenses/expense-forms";
import { CLINIC_TIMEZONE, formatDateKey } from "@/lib/calendar/time";
import { clinicHasFeature } from "@/lib/entitlements";
import { canAccessExpenses, canWriteExpenses } from "@/lib/expenses/rbac";
import { roundMoney } from "@/lib/invoices/money";
import { formatMoney, currencyLabel } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/validations/expense";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function ExpensesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, category: categoryParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Expenses");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canAccessExpenses(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const featureOk = await clinicHasFeature(
    supabase,
    profile!.clinic_id,
    "expenses_reports_excel",
  );
  if (!featureOk) {
    redirect({ href: "/dashboard", locale });
  }

  const canWrite = canWriteExpenses(profile!.role);
  const query = q?.trim() ?? "";
  const category =
    categoryParam &&
    (EXPENSE_CATEGORIES as readonly string[]).includes(categoryParam)
      ? (categoryParam as ExpenseCategory)
      : "all";

  let expensesQuery = supabase
    .from("expenses")
    .select(
      "id, category, description, amount, expense_date, vendor, notes, voided_at",
    )
    .eq("clinic_id", profile!.clinic_id)
    .order("expense_date", { ascending: false })
    .limit(200);

  if (category !== "all") {
    expensesQuery = expensesQuery.eq("category", category);
  }

  const [{ data: expenses }, { data: clinic }] = await Promise.all([
    expensesQuery,
    supabase
      .from("clinics")
      .select("timezone")
      .eq("id", profile!.clinic_id)
      .maybeSingle(),
  ]);

  let rows: ExpenseRow[] = (expenses ?? []).map((e) => ({
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    expenseDate: e.expense_date,
    vendor: e.vendor,
    notes: e.notes,
    voidedAt: e.voided_at,
  }));

  if (query) {
    const qLower = query.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.description.toLowerCase().includes(qLower) ||
        (row.vendor?.toLowerCase().includes(qLower) ?? false),
    );
  }

  const activeTotal = roundMoney(
    rows
      .filter((r) => !r.voidedAt)
      .reduce((acc, r) => acc + r.amount, 0),
  );

  const timeZone = clinic?.timezone || CLINIC_TIMEZONE;
  const to = formatDateKey(new Date(), timeZone);
  const from = format(
    addMonths(startOfMonth(toZonedTime(new Date(), timeZone)), -5),
    "yyyy-MM-dd",
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <ExcelExportLink from={from} to={to} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>
            {t("listDescription")} · {t("activeTotal")}:{" "}
            {formatMoney(activeTotal, locale)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExpenseSearchForm
            initialQuery={query}
            initialCategory={category}
          />
          <ExpensesTable rows={rows} canWrite={canWrite} />
        </CardContent>
      </Card>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
            <CardDescription>
              {t("createDescription", { currency: currencyLabel(locale) })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateExpenseForm />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
