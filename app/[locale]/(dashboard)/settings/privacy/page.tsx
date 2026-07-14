import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CloseClinicAccountCard } from "@/components/clinic/close-account-form";
import {
  ErasureRequestsTable,
  ExportClinicZipLink,
} from "@/components/privacy/privacy-forms";
import { canManagePrivacy } from "@/lib/privacy/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ClinicStatus = Database["public"]["Enums"]["clinic_status"];

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const tLife = await getTranslations("ClinicLifecycle");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, clinic_id, clinics(name, status, grace_ends_at)",
    )
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canManagePrivacy(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const clinic = profile!.clinics as {
    name: string;
    status: ClinicStatus;
    grace_ends_at: string | null;
  } | null;

  const { data: requests } = await supabase
    .from("gdpr_erasure_requests")
    .select(
      "id, status, created_at, patient_id, patient_snapshot, rejection_reason, error_message, completed_at",
    )
    .eq("clinic_id", profile!.clinic_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            {t("backDashboard")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("clinicZipTitle")}</CardTitle>
          <CardDescription>{t("clinicZipDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("clinicZipHint")}</p>
          <p className="text-muted-foreground text-sm">{t("clinicZipClosureNote")}</p>
          <div>
            <ExportClinicZipLink />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tLife("closeCardTitle")}</CardTitle>
          <CardDescription>{tLife("closeCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CloseClinicAccountCard
            clinicName={clinic?.name ?? ""}
            status={clinic?.status ?? "active"}
            graceEndsAt={clinic?.grace_ends_at ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("exportCardTitle")}</CardTitle>
          <CardDescription>{t("exportCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t("exportHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("erasureCardTitle")}</CardTitle>
          <CardDescription>{t("erasureCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ErasureRequestsTable rows={requests ?? []} isOwner />
        </CardContent>
      </Card>
    </main>
  );
}
