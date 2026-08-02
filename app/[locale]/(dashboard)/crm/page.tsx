import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CrmInboxList } from "@/components/crm/crm-inbox";
import { canAccessCrm } from "@/lib/crm/rbac";
import { loadOpenCrmNotifications } from "@/lib/crm/load";
import { clinicHasFeature } from "@/lib/entitlements";
import { getClinicContext } from "@/lib/supabase/clinic-context";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CrmPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Crm");
  const supabase = await createClient();

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { profile } = ctx!;

  if (!canAccessCrm(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const featureOk = await clinicHasFeature(
    supabase,
    profile.clinic_id,
    "crm_light",
  );

  const notifications = featureOk
    ? await loadOpenCrmNotifications(profile.clinic_id)
    : [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {!featureOk ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("upsellTitle")}</CardTitle>
            <CardDescription>{t("upsellDescription")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("inboxTitle")}</CardTitle>
            <CardDescription>{t("inboxDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CrmInboxList notifications={notifications} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
