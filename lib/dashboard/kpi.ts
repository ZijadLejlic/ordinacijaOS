import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { CLINIC_TIMEZONE, formatDateKey } from "@/lib/calendar/time";
import { roundMoney } from "@/lib/invoices/money";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type AppRole = Database["public"]["Enums"]["app_role"];

export type DashboardKpiBundle = {
  todayAppointments: number | null;
  todayRevenue: number | null;
  activePatients: number | null;
  newPatientsMonth: number | null;
  lostPatients: number | null;
  monthRevenue: number | null;
  monthExpenses: number | null;
  monthProfit: number | null;
  revenueByDoctor: Array<{
    doctorId: string;
    doctorName: string;
    amount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
};

type PaymentStats = {
  today_revenue: number;
  month_revenue: number;
  by_doctor: Array<{
    doctor_id: string;
    doctor_name: string;
    amount: number;
  }>;
  trend: Array<{ month: string; revenue: number }>;
};

function zonedDayBounds(ymd: string, timeZone: string) {
  const start = fromZonedTime(`${ymd}T00:00:00`, timeZone);
  return { start: start.toISOString(), end: addDays(start, 1).toISOString() };
}

function monthWindow(anchor: Date, timeZone: string) {
  const zoned = toZonedTime(anchor, timeZone);
  const startLocal = startOfMonth(zoned);
  const startYmd = format(startLocal, "yyyy-MM-dd");
  const start = fromZonedTime(`${startYmd}T00:00:00`, timeZone);
  const end = addMonths(start, 1);
  const endYmd = format(toZonedTime(end, timeZone), "yyyy-MM-dd");
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startYmd,
    endYmd,
  };
}

function monthKeysLast6(timeZone: string): string[] {
  const keys: string[] = [];
  const base = startOfMonth(toZonedTime(new Date(), timeZone));
  for (let i = 5; i >= 0; i -= 1) {
    keys.push(format(addMonths(base, -i), "yyyy-MM"));
  }
  return keys;
}

function parsePaymentStats(raw: Json | null): PaymentStats {
  const empty: PaymentStats = {
    today_revenue: 0,
    month_revenue: 0,
    by_doctor: [],
    trend: [],
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const obj = raw as Record<string, unknown>;
  const byDoctorRaw = Array.isArray(obj.by_doctor) ? obj.by_doctor : [];
  const trendRaw = Array.isArray(obj.trend) ? obj.trend : [];
  return {
    today_revenue: Number(obj.today_revenue ?? 0),
    month_revenue: Number(obj.month_revenue ?? 0),
    by_doctor: byDoctorRaw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        doctor_id: String(x.doctor_id ?? ""),
        doctor_name: String(x.doctor_name ?? "—"),
        amount: Number(x.amount ?? 0),
      })),
    trend: trendRaw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        month: String(x.month ?? ""),
        revenue: Number(x.revenue ?? 0),
      })),
  };
}

export async function loadDashboardKpis(
  supabase: Client,
  opts: {
    clinicId: string;
    role: AppRole;
    userId: string;
    timeZone?: string;
    includeFinance: boolean;
    includeOperational: boolean;
    includeExpenses: boolean;
  },
): Promise<DashboardKpiBundle> {
  const timeZone = opts.timeZone || CLINIC_TIMEZONE;
  const todayYmd = formatDateKey(new Date(), timeZone);
  const { start: todayStart, end: todayEnd } = zonedDayBounds(todayYmd, timeZone);
  const month = monthWindow(new Date(), timeZone);
  const trendStartLocal = addMonths(
    startOfMonth(toZonedTime(new Date(), timeZone)),
    -5,
  );
  const trendStartYmd = format(trendStartLocal, "yyyy-MM-dd");
  const trendStartIso = fromZonedTime(
    `${trendStartYmd}T00:00:00`,
    timeZone,
  ).toISOString();
  const lostCutoff = addDays(
    fromZonedTime(`${todayYmd}T00:00:00`, timeZone),
    -90,
  ).toISOString();

  const result: DashboardKpiBundle = {
    todayAppointments: null,
    todayRevenue: null,
    activePatients: null,
    newPatientsMonth: null,
    lostPatients: null,
    monthRevenue: null,
    monthExpenses: null,
    monthProfit: null,
    revenueByDoctor: [],
    monthlyTrend: [],
  };

  if (opts.includeOperational) {
    let apptQuery = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", opts.clinicId)
      .gte("starts_at", todayStart)
      .lt("starts_at", todayEnd)
      .not("status", "in", '("cancelled","no_show")');

    if (opts.role === "doctor") {
      apptQuery = apptQuery.eq("doctor_id", opts.userId);
    }

    const [
      { count: apptCount },
      { count: activeCount },
      { count: newCount },
      { data: activeRows },
    ] = await Promise.all([
      apptQuery,
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", opts.clinicId)
        .eq("is_active", true),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", opts.clinicId)
        .gte("created_at", month.startIso)
        .lt("created_at", month.endIso),
      supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", opts.clinicId)
        .eq("is_active", true),
    ]);

    result.todayAppointments = apptCount ?? 0;
    result.activePatients = activeCount ?? 0;
    result.newPatientsMonth = newCount ?? 0;

    const patientIds = (activeRows ?? []).map((p) => p.id);
    if (patientIds.length === 0) {
      result.lostPatients = 0;
    } else {
      const { data: recent } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", opts.clinicId)
        .gte("starts_at", lostCutoff)
        .neq("status", "cancelled");

      const seen = new Set((recent ?? []).map((r) => r.patient_id));
      result.lostPatients = patientIds.filter((id) => !seen.has(id)).length;
    }
  }

  if (!opts.includeFinance) {
    return result;
  }

  const { data: statsRaw } = await supabase.rpc("dashboard_payment_stats", {
    p_today_start: todayStart,
    p_today_end: todayEnd,
    p_month_start: month.startIso,
    p_month_end: month.endIso,
    p_trend_start: trendStartIso,
  });

  const stats = parsePaymentStats(statsRaw as Json);
  result.todayRevenue = roundMoney(stats.today_revenue);
  result.monthRevenue = roundMoney(stats.month_revenue);
  result.revenueByDoctor = stats.by_doctor.map((d) => ({
    doctorId: d.doctor_id,
    doctorName: d.doctor_name,
    amount: roundMoney(d.amount),
  }));

  const revByMonth = new Map(
    stats.trend.map((t) => [t.month, roundMoney(t.revenue)] as const),
  );
  const expByMonth = new Map<string, number>();

  if (opts.includeExpenses) {
    const [{ data: expenseMonth }, { data: expenseTrend }] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount")
        .eq("clinic_id", opts.clinicId)
        .is("voided_at", null)
        .gte("expense_date", month.startYmd)
        .lt("expense_date", month.endYmd),
      supabase
        .from("expenses")
        .select("amount, expense_date")
        .eq("clinic_id", opts.clinicId)
        .is("voided_at", null)
        .gte("expense_date", trendStartYmd),
    ]);

    result.monthExpenses = roundMoney(
      (expenseMonth ?? []).reduce((acc, e) => acc + Number(e.amount), 0),
    );
    result.monthProfit = roundMoney(
      (result.monthRevenue ?? 0) - (result.monthExpenses ?? 0),
    );

    for (const e of expenseTrend ?? []) {
      const key = e.expense_date.slice(0, 7);
      expByMonth.set(
        key,
        roundMoney((expByMonth.get(key) ?? 0) + Number(e.amount)),
      );
    }
  }

  result.monthlyTrend = monthKeysLast6(timeZone).map((key) => {
    const revenue = revByMonth.get(key) ?? 0;
    const expenses = opts.includeExpenses ? (expByMonth.get(key) ?? 0) : 0;
    return {
      month: key,
      revenue,
      expenses,
      profit: roundMoney(revenue - expenses),
    };
  });

  return result;
}
