import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BrandingColorsForm,
  BrandingLogoForm,
} from "@/components/branding/branding-forms";
import { parseBrandingJson } from "@/lib/branding/parse";
import { canManageBranding } from "@/lib/branding/rbac";
import {
  BRANDING_SIGNED_URL_TTL_SECONDS,
  CLINIC_BRANDING_BUCKET,
} from "@/lib/branding/storage";
import { clinicHasFeature } from "@/lib/entitlements";
import { getClinicContext } from "@/lib/supabase/clinic-context";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsBrandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Branding");
  const supabase = await createClient();

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { profile, clinic } = ctx!;

  if (!canManageBranding(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const featureOk = await clinicHasFeature(
    supabase,
    profile.clinic_id,
    "branding_custom",
  );

  const branding = parseBrandingJson(clinic?.branding_json);

  let logoPreviewUrl: string | null = null;
  if (featureOk && branding.logoPath) {
    const { data } = await supabase.storage
      .from(CLINIC_BRANDING_BUCKET)
      .createSignedUrl(branding.logoPath, BRANDING_SIGNED_URL_TTL_SECONDS);
    logoPreviewUrl = data?.signedUrl ?? null;
  } else if (featureOk && branding.logoUrl) {
    logoPreviewUrl = branding.logoUrl;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("logoCardTitle")}</CardTitle>
              <CardDescription>{t("logoCardDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingLogoForm logoPreviewUrl={logoPreviewUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("colorsCardTitle")}</CardTitle>
              <CardDescription>{t("colorsCardDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingColorsForm colors={branding.colors} />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
