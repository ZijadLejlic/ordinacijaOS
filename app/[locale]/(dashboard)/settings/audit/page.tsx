import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuditLogTable } from "@/components/audit/audit-log-table";
import { AUDIT_EVENT_FILTERS, loadAuditEvents } from "@/lib/audit/load";
import { canViewAuditLog } from "@/lib/audit/rbac";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ event?: string; page?: string }>;
};

export default async function SettingsAuditPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("AuditLog");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canViewAuditLog(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const eventName =
    sp.event && AUDIT_EVENT_FILTERS.includes(
      sp.event as (typeof AUDIT_EVENT_FILTERS)[number],
    )
      ? sp.event
      : sp.event && sp.event.length > 0 && sp.event.length < 120
        ? sp.event
        : null;

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total, pageSize } = await loadAuditEvents(
    supabase,
    profile!.clinic_id,
    { eventName, page },
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            {t("backDashboard")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("filterTitle")}</CardTitle>
          <CardDescription>{t("filterDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("eventLabel")}</span>
              <select
                name="event"
                defaultValue={eventName ?? ""}
                className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
              >
                <option value="">{t("allEvents")}</option>
                {AUDIT_EVENT_FILTERS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="bg-primary text-primary-foreground h-8 rounded-lg px-3 text-sm font-medium"
            >
              {t("applyFilter")}
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable
            rows={rows}
            page={page}
            total={total}
            pageSize={pageSize}
            eventName={eventName}
          />
        </CardContent>
      </Card>
    </main>
  );
}
