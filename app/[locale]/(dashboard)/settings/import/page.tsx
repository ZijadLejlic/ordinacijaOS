import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PatientsImportForm,
  ServicesImportForm,
} from "@/components/import/import-forms";
import {
  canAccessImport,
  canImportPatients,
  canImportServices,
} from "@/lib/import/rbac";
import { currencyLabel } from "@/lib/money/format";
import { needsOnboarding } from "@/lib/onboarding/parse";
import { getClinicContext } from "@/lib/supabase/clinic-context";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsImportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Import");

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { profile, clinic } = ctx!;

  if (!canAccessImport(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const showPatients = canImportPatients(profile.role);
  const showServices = canImportServices(profile.role);
  const showOnboardingReturn =
    profile.role === "owner" && needsOnboarding(clinic?.settings_json);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        {showOnboardingReturn ? (
          <p className="mt-2 text-sm">
            <Link href="/onboarding" className="underline">
              {t("backToOnboarding")}
            </Link>
          </p>
        ) : null}
      </div>

      {showPatients ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("patients.title")}</CardTitle>
            <CardDescription>{t("patients.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <PatientsImportForm />
          </CardContent>
        </Card>
      ) : null}

      {showServices ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("services.title")}</CardTitle>
            <CardDescription>
              {t("services.description", { currency: currencyLabel(locale) })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServicesImportForm />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
