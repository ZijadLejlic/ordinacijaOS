import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailTemplateForms } from "@/components/email/email-template-forms";
import { loadEmailTemplatesForClinic } from "@/lib/email/load";
import {
  canReadEmailTemplates,
  canWriteEmailTemplates,
} from "@/lib/email/rbac";
import {
  type EmailTemplateKey,
} from "@/lib/email/templates";
import { clinicHasFeature } from "@/lib/entitlements";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

const CARD_KEYS: {
  key: EmailTemplateKey;
  titleKey:
    | "reminderCardTitle"
    | "birthdayCardTitle"
    | "recallCardTitle"
    | "controlCardTitle";
  descriptionKey:
    | "reminderCardDescription"
    | "birthdayCardDescription"
    | "recallCardDescription"
    | "controlCardDescription";
}[] = [
  {
    key: "appointment_reminder",
    titleKey: "reminderCardTitle",
    descriptionKey: "reminderCardDescription",
  },
  {
    key: "birthday",
    titleKey: "birthdayCardTitle",
    descriptionKey: "birthdayCardDescription",
  },
  {
    key: "recall",
    titleKey: "recallCardTitle",
    descriptionKey: "recallCardDescription",
  },
  {
    key: "control",
    titleKey: "controlCardTitle",
    descriptionKey: "controlCardDescription",
  },
];

export default async function SettingsEmailPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("EmailTemplates");
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

  if (!profile || !canReadEmailTemplates(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const featureOk = await clinicHasFeature(
    supabase,
    profile!.clinic_id,
    "email_reminders",
  );

  const templates = featureOk
    ? await loadEmailTemplatesForClinic(profile!.clinic_id)
    : [];

  const canEdit = canWriteEmailTemplates(profile!.role);

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
                <EmailTemplateForms templates={group} canEdit={canEdit} />
              </CardContent>
            </Card>
          );
        })
      )}
    </main>
  );
}
