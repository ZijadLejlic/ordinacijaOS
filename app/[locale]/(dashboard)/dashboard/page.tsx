import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { clearOperatorSessionAction } from "@/lib/operators/actions";
import { getOperatorIdFromCookie } from "@/lib/operators/session";
import { getClinicEntitlements } from "@/lib/entitlements";
import { ClinicTelemetry } from "@/components/analytics/clinic-telemetry";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, clinic_id, clinics(name, trial_ends_at, status)")
    .eq("id", user!.id)
    .maybeSingle();

  const clinic = profile?.clinics as
    | { name: string; trial_ends_at: string | null; status: string }
    | null
    | undefined;

  const entitlements = profile?.clinic_id
    ? await getClinicEntitlements(supabase, profile.clinic_id)
    : null;

  const operatorId = await getOperatorIdFromCookie();
  let operatorName: string | null = null;
  if (operatorId) {
    const { data: op } = await supabase
      .from("clinic_operators")
      .select("display_name")
      .eq("id", operatorId)
      .maybeSingle();
    operatorName = op?.display_name ?? null;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      {profile?.clinic_id && profile.role ? (
        <ClinicTelemetry
          userId={user!.id}
          clinicId={profile.clinic_id}
          role={profile.role}
        />
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            {t("logout")}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{clinic?.name ?? t("clinicFallback")}</CardTitle>
          <CardDescription>
            {profile?.full_name} · {profile?.role}
            {operatorName ? ` · ${operatorName}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>
            {t("status")}: {clinic?.status ?? "—"}
          </p>
          <p>
            {t("trialEnds")}:{" "}
            {clinic?.trial_ends_at
              ? new Date(clinic.trial_ends_at).toLocaleDateString(locale)
              : "—"}
          </p>
          {entitlements ? (
            <p>
              {t("plan")}: {entitlements.planCode}
              {entitlements.freePeriodOverride ? " · free 2026" : ""}
            </p>
          ) : null}
          <p>{t("featuresHint")}</p>
          <p>{t("nextSteps")}</p>
          <p>
            <Link
              href="/settings/users"
              className="text-foreground underline-offset-4 hover:underline"
            >
              {t("manageUsers")}
            </Link>
          </p>
          {operatorName ? (
            <form action={clearOperatorSessionAction}>
              <Button type="submit" variant="ghost" size="sm">
                {t("switchOperator")}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
