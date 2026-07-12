import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MfaVerifyForm } from "@/components/auth/mfa-forms";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MfaVerifyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Mfa");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("verifyTitle")}</CardTitle>
          <CardDescription>{t("verifyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaVerifyForm />
        </CardContent>
      </Card>
    </main>
  );
}
