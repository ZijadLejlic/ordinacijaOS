import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getClinicEntitlements } from "@/lib/entitlements";
import { canAccessCalendar } from "@/lib/calendar/rbac";
import {
  canSeeDashboardKpis,
  canSeeFinancialKpis,
  canSeeOperationalKpis,
} from "@/lib/dashboard/rbac";
import { loadDashboardKpis } from "@/lib/dashboard/kpi";
import { canAccessExpenses } from "@/lib/expenses/rbac";
import { canAccessInvoices } from "@/lib/invoices/rbac";
import {
  canAccessPatients,
  canReadServices,
} from "@/lib/patients/rbac";
import { formatMoney } from "@/lib/money/format";
import { getClinicContext } from "@/lib/supabase/clinic-context";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();
  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { user, profile, clinic } = ctx!;

  const entitlements = profile.clinic_id
    ? await getClinicEntitlements(supabase, profile.clinic_id)
    : null;

  const role = profile.role;
  const showPatients = role ? canAccessPatients(role) : false;
  const showServices = role ? canReadServices(role) : false;
  const showCalendar = role ? canAccessCalendar(role) : false;
  const showInvoices = role ? canAccessInvoices(role) : false;
  const showExpenses =
    role && entitlements
      ? canAccessExpenses(role) &&
        entitlements.features.expenses_reports_excel.enabled
      : false;
  const isOwner = role === "owner";

  const includeOperational = role ? canSeeOperationalKpis(role) : false;
  const includeFinance =
    role != null &&
    (canSeeFinancialKpis(role) ||
      (role === "doctor" && canSeeDashboardKpis(role)));
  const includeExpenses = Boolean(showExpenses && canSeeFinancialKpis(role!));

  const kpis =
    profile.clinic_id && role && canSeeDashboardKpis(role)
      ? await loadDashboardKpis(supabase, {
          clinicId: profile.clinic_id,
          role,
          userId: user.id,
          timeZone: clinic?.timezone,
          includeFinance,
          includeOperational,
          includeExpenses,
        })
      : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{clinic?.name ?? t("clinicFallback")}</CardTitle>
          <CardDescription>
            {t("status")}: {clinic?.status ?? "—"} · {t("trialEnds")}:{" "}
            {clinic?.trial_ends_at
              ? new Date(clinic.trial_ends_at).toLocaleDateString(locale)
              : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          {entitlements ? (
            <p>
              {t("plan")}: {entitlements.planCode}
              {entitlements.freePeriodOverride ? " · free 2026" : ""}
            </p>
          ) : null}
          {isOwner ? (
            <p>
              <Link
                href="/settings/users"
                className="text-foreground underline-offset-4 hover:underline"
              >
                {t("manageUsers")}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {kpis ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.todayAppointments != null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("kpiTodayAppointments")}</CardDescription>
                <CardTitle className="text-2xl">
                  {kpis.todayAppointments}
                </CardTitle>
              </CardHeader>
            </Card>
          ) : null}
          {kpis.todayRevenue != null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("kpiTodayRevenue")}</CardDescription>
                <CardTitle className="text-2xl">
                  {formatMoney(kpis.todayRevenue, locale)}
                </CardTitle>
              </CardHeader>
            </Card>
          ) : null}
          {kpis.activePatients != null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("kpiActivePatients")}</CardDescription>
                <CardTitle className="text-2xl">{kpis.activePatients}</CardTitle>
              </CardHeader>
            </Card>
          ) : null}
          {kpis.monthProfit != null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("kpiMonthProfit")}</CardDescription>
                <CardTitle className="text-2xl">
                  {formatMoney(kpis.monthProfit, locale)}
                </CardTitle>
              </CardHeader>
            </Card>
          ) : kpis.monthRevenue != null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("kpiMonthRevenue")}</CardDescription>
                <CardTitle className="text-2xl">
                  {formatMoney(kpis.monthRevenue, locale)}
                </CardTitle>
              </CardHeader>
            </Card>
          ) : null}
        </section>
      ) : null}

      {kpis &&
      (kpis.newPatientsMonth != null ||
        kpis.lostPatients != null ||
        kpis.revenueByDoctor.length > 0 ||
        kpis.monthlyTrend.length > 0) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {kpis.newPatientsMonth != null || kpis.lostPatients != null ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("kpiPatientsTitle")}</CardTitle>
                <CardDescription>{t("kpiPatientsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {kpis.newPatientsMonth != null ? (
                  <p>
                    {t("kpiNewPatients")}:{" "}
                    <span className="font-medium">{kpis.newPatientsMonth}</span>
                  </p>
                ) : null}
                {kpis.lostPatients != null ? (
                  <p>
                    {t("kpiLostPatients")}:{" "}
                    <span className="font-medium">{kpis.lostPatients}</span>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {kpis.revenueByDoctor.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("kpiRevenueByDoctor")}</CardTitle>
                <CardDescription>
                  {t("kpiRevenueByDoctorDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {kpis.revenueByDoctor.map((row) => (
                    <li
                      key={row.doctorId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{row.doctorName}</span>
                      <span className="font-medium whitespace-nowrap">
                        {formatMoney(row.amount, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {kpis.monthlyTrend.length > 0 ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("kpiMonthlyTrend")}</CardTitle>
                <CardDescription>
                  {t("kpiMonthlyTrendDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left">
                        <th className="py-2 pr-3 font-medium">{t("kpiMonth")}</th>
                        <th className="py-2 pr-3 font-medium">
                          {t("kpiRevenue")}
                        </th>
                        {includeExpenses ? (
                          <>
                            <th className="py-2 pr-3 font-medium">
                              {t("kpiExpenses")}
                            </th>
                            <th className="py-2 font-medium">{t("kpiProfit")}</th>
                          </>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.monthlyTrend.map((row) => (
                        <tr key={row.month} className="border-b last:border-0">
                          <td className="py-2 pr-3">{row.month}</td>
                          <td className="py-2 pr-3">
                            {formatMoney(row.revenue, locale)}
                          </td>
                          {includeExpenses ? (
                            <>
                              <td className="py-2 pr-3">
                                {formatMoney(row.expenses, locale)}
                              </td>
                              <td className="py-2">
                                {formatMoney(row.profit, locale)}
                              </td>
                            </>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {showCalendar ? (
          <Link href="/calendar" className="block h-full">
            <Card className="hover:bg-muted/50 h-full transition-colors">
              <CardHeader>
                <CardTitle>{t("calendarCardTitle")}</CardTitle>
                <CardDescription>
                  {t("calendarCardDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
        {showPatients ? (
          <Link href="/patients" className="block h-full">
            <Card className="hover:bg-muted/50 h-full transition-colors">
              <CardHeader>
                <CardTitle>{t("patientsCardTitle")}</CardTitle>
                <CardDescription>
                  {t("patientsCardDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
        {showServices ? (
          <Link href="/services" className="block h-full">
            <Card className="hover:bg-muted/50 h-full transition-colors">
              <CardHeader>
                <CardTitle>{t("servicesCardTitle")}</CardTitle>
                <CardDescription>
                  {t("servicesCardDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
        {showInvoices ? (
          <Link href="/invoices" className="block h-full">
            <Card className="hover:bg-muted/50 h-full transition-colors">
              <CardHeader>
                <CardTitle>{t("invoicesCardTitle")}</CardTitle>
                <CardDescription>
                  {t("invoicesCardDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
        {showExpenses ? (
          <Link href="/expenses" className="block h-full">
            <Card className="hover:bg-muted/50 h-full transition-colors">
              <CardHeader>
                <CardTitle>{t("expensesCardTitle")}</CardTitle>
                <CardDescription>
                  {t("expensesCardDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
      </div>
    </main>
  );
}
