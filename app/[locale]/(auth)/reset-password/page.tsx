import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>
            {user
              ? t("resetPasswordDescription")
              : t("resetSessionExpired")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <ResetPasswordForm />
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-foreground underline-offset-4 hover:underline"
              >
                {t("requestNewResetLink")}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
