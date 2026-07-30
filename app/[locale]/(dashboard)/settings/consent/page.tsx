import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConsentTemplateForms } from "@/components/consent/consent-template-forms";
import { loadConsentFormsForClinic } from "@/lib/consent/load";
import {
  canReadConsentForms,
  canWriteConsentForms,
} from "@/lib/consent/rbac";
import type { ConsentTemplateKey } from "@/lib/consent/templates";
import { clinicHasFeature } from "@/lib/entitlements";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

const CARD_KEYS: {
  key: ConsentTemplateKey;
  titleKey:
    | "generalCardTitle"
    | "dataCardTitle"
    | "radiographyCardTitle";
  descriptionKey:
    | "generalCardDescription"
    | "dataCardDescription"
    | "radiographyCardDescription";
}[] = [
  {
    key: "general_treatment",
    titleKey: "generalCardTitle",
    descriptionKey: "generalCardDescription",
  },
  {
    key: "data_processing",
    titleKey: "dataCardTitle",
    descriptionKey: "dataCardDescription",
  },
  {
    key: "radiography",
    titleKey: "radiographyCardTitle",
    descriptionKey: "radiographyCardDescription",
  },
];

export default async function SettingsConsentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ConsentTemplates");
  const supabase = await createClient();

  const user = await getAuthUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canReadConsentForms(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const featureOk = await clinicHasFeature(
    supabase,
    profile!.clinic_id,
    "consent_draw_sign",
  );

  const templates = featureOk
    ? await loadConsentFormsForClinic(profile!.clinic_id)
    : [];

  const canEdit = canWriteConsentForms(profile!.role);

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
        CARD_KEYS.map((card) => {
          const group = templates.filter((row) => row.templateKey === card.key);
          if (group.length === 0) return null;
          return (
            <Card key={card.key}>
              <CardHeader>
                <CardTitle>{t(card.titleKey)}</CardTitle>
                <CardDescription>{t(card.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent>
                <ConsentTemplateForms templates={group} canEdit={canEdit} />
              </CardContent>
            </Card>
          );
        })
      )}
    </main>
  );
}
