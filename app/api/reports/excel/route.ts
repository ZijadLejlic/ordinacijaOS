import { NextResponse } from "next/server";
import { addMonths, format, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { getLocale } from "next-intl/server";
import { CLINIC_TIMEZONE, formatDateKey } from "@/lib/calendar/time";
import { clinicHasFeature } from "@/lib/entitlements";
import { canAccessExpenses } from "@/lib/expenses/rbac";
import { formatInvoiceNumber, roundMoney } from "@/lib/invoices/money";
import { currencyLabel } from "@/lib/money/format";
import { buildFinanceWorkbook } from "@/lib/reports/excel";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canAccessExpenses(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const allowed = await clinicHasFeature(
    supabase,
    profile.clinic_id,
    "expenses_reports_excel",
  );
  if (!allowed) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, timezone")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const timeZone = clinic?.timezone || CLINIC_TIMEZONE;
  const todayYmd = formatDateKey(new Date(), timeZone);
  const defaultFrom = format(
    addMonths(startOfMonth(toZonedTime(new Date(), timeZone)), -5),
    "yyyy-MM-dd",
  );
  const fromYmd =
    fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : defaultFrom;
  const toYmd =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : todayYmd;

  const fromIso = fromZonedTime(`${fromYmd}T00:00:00`, timeZone).toISOString();
  const toEndIso = fromZonedTime(
    `${toYmd}T23:59:59.999`,
    timeZone,
  ).toISOString();

  const [{ data: expenses }, { data: payments }, { data: doctors }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select(
          "expense_date, category, description, vendor, amount, voided_at",
        )
        .eq("clinic_id", profile.clinic_id)
        .gte("expense_date", fromYmd)
        .lte("expense_date", toYmd)
        .order("expense_date", { ascending: false })
        .limit(5000),
      supabase
        .from("payments")
        .select(
          "amount, method, paid_at, invoices!inner(series_year, series_number, doctor_id, status)",
        )
        .eq("clinic_id", profile.clinic_id)
        .gte("paid_at", fromIso)
        .lte("paid_at", toEndIso)
        .order("paid_at", { ascending: false })
        .limit(5000),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("clinic_id", profile.clinic_id)
        .eq("role", "doctor"),
    ]);

  const doctorName = new Map((doctors ?? []).map((d) => [d.id, d.full_name]));

  const expenseRows = (expenses ?? []).map((e) => ({
    date: e.expense_date,
    category: e.category,
    description: e.description,
    vendor: e.vendor ?? "",
    amount: Number(e.amount),
    status: e.voided_at ? "void" : "active",
  }));

  type PayRow = {
    amount: number | string;
    method: string;
    paid_at: string;
    invoices: {
      series_year: number;
      series_number: number;
      doctor_id: string | null;
      status: string;
    } | null;
  };

  const paymentRows = ((payments as PayRow[] | null) ?? [])
    .filter((p) => p.invoices && p.invoices.status !== "void")
    .map((p) => ({
      paidAt: `${formatDateKey(new Date(p.paid_at), timeZone)} ${p.paid_at.slice(11, 16)}`,
      invoiceNumber: formatInvoiceNumber(
        p.invoices!.series_year,
        p.invoices!.series_number,
      ),
      method: p.method,
      amount: Number(p.amount),
      doctorName: p.invoices!.doctor_id
        ? (doctorName.get(p.invoices!.doctor_id) ?? "—")
        : "—",
    }));

  const revByMonth = new Map<string, number>();
  const expByMonth = new Map<string, number>();
  for (const p of paymentRows) {
    const key = p.paidAt.slice(0, 7);
    revByMonth.set(key, roundMoney((revByMonth.get(key) ?? 0) + p.amount));
  }
  for (const e of expenseRows) {
    if (e.status === "void") continue;
    const key = e.date.slice(0, 7);
    expByMonth.set(key, roundMoney((expByMonth.get(key) ?? 0) + e.amount));
  }

  const monthKeys = [
    ...new Set([...revByMonth.keys(), ...expByMonth.keys()]),
  ].sort();
  const months = monthKeys.map((month) => {
    const revenue = revByMonth.get(month) ?? 0;
    const expensesAmt = expByMonth.get(month) ?? 0;
    return {
      month,
      revenue,
      expenses: expensesAmt,
      profit: roundMoney(revenue - expensesAmt),
    };
  });

  const locale = await getLocale();
  const buffer = await buildFinanceWorkbook({
    clinicName: clinic?.name ?? "Clinic",
    generatedAt: new Date().toISOString(),
    currencyLabel: currencyLabel(locale),
    expenses: expenseRows,
    payments: paymentRows,
    months,
  });

  const filename = `dentord-finance-${fromYmd}_${toYmd}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
