import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PinSwitchForm } from "@/components/operators/pin-switch-form";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PinSwitchPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pin");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: operators } = await supabase
    .from("clinic_operators")
    .select("id, display_name")
    .eq("profile_id", user!.id)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PinSwitchForm
            operators={(operators ?? []).map((o) => ({
              id: o.id,
              displayName: o.display_name,
            }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
