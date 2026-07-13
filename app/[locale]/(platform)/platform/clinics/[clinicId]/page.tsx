import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClinicPlanForm,
  ClinicStatusForm,
  StartImpersonationForm,
  SubscriptionStatusForm,
} from "@/components/platform/clinic-forms";
import { FEATURE_KEYS } from "@/lib/entitlements";
import { getPlatformClinicDetail } from "@/lib/platform/data";

type Props = {
  params: Promise<{ locale: string; clinicId: string }>;
};

export default async function PlatformClinicPage({ params }: Props) {
  const { locale, clinicId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Platform");
  const detail = await getPlatformClinicDetail(clinicId);

  if (!detail) {
    notFound();
  }

  const { clinic, subscription, plans, owners, entitlements } = detail;
  const enabledFeatures = FEATURE_KEYS.filter(
    (key) => entitlements.features[key]?.enabled,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          <Link
            href="/platform"
            className="underline-offset-4 hover:underline"
          >
            {t("back")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{clinic.name}</h1>
        <p className="text-muted-foreground text-sm">
          {clinic.id} · {clinic.timezone} · {clinic.phoneCountryDefault}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("billingTitle")}</CardTitle>
          <CardDescription>{t("billingDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 sm:grid-cols-2">
          <ClinicStatusForm clinicId={clinic.id} status={clinic.status} />
          <ClinicPlanForm
            clinicId={clinic.id}
            planId={clinic.planId}
            plans={plans}
          />
          {subscription ? (
            <SubscriptionStatusForm
              clinicId={clinic.id}
              status={subscription.status}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("noSubscription")}
            </p>
          )}
          <div className="text-muted-foreground space-y-1 text-sm">
            <p>
              {t("trialEnds")}:{" "}
              {clinic.trialEndsAt
                ? new Date(clinic.trialEndsAt).toLocaleDateString(locale)
                : "—"}
            </p>
            <p>
              {t("stripeCustomer")}: {subscription?.stripe_customer_id ?? "—"}
            </p>
            <p>
              {t("currentPlan")}: {clinic.plan?.code ?? entitlements.planCode}
              {entitlements.freePeriodOverride ? " · free 2026" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("entitlementsTitle")}</CardTitle>
          <CardDescription>{t("entitlementsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
            {enabledFeatures.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ownersTitle")}</CardTitle>
          <CardDescription>{t("ownersDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm">
            {owners.map((owner) => (
              <li key={owner.id}>
                {owner.full_name}
                {!owner.is_active ? ` (${t("inactive")})` : null}
              </li>
            ))}
          </ul>
          <StartImpersonationForm clinicId={clinic.id} />
        </CardContent>
      </Card>
    </main>
  );
}
