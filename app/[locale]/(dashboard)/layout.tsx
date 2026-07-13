import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import {
  hasCustomColors,
  parseBrandingJson,
} from "@/lib/branding/parse";
import {
  BRANDING_SIGNED_URL_TTL_SECONDS,
  CLINIC_BRANDING_BUCKET,
} from "@/lib/branding/storage";
import { clinicHasFeature } from "@/lib/entitlements";
import { canAccessExpenses } from "@/lib/expenses/rbac";
import { getOperatorIdFromCookie } from "@/lib/operators/session";
import { createClient } from "@/lib/supabase/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Nav");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, clinic_id, clinics(name, branding_json)")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile) {
    redirect({ href: "/login", locale });
  }

  const clinic = profile!.clinics as {
    name: string;
    branding_json: unknown;
  } | null;

  const operatorId = await getOperatorIdFromCookie();
  let operatorName: string | null = null;
  if (operatorId) {
    const { data: op } = await supabase
      .from("clinic_operators")
      .select("display_name")
      .eq("id", operatorId)
      .maybeSingle();
    operatorName = op?.display_name ?? null;
  }

  const [showExpenses, brandingEnabled] = await Promise.all([
    canAccessExpenses(profile!.role)
      ? clinicHasFeature(
          supabase,
          profile!.clinic_id,
          "expenses_reports_excel",
        )
      : Promise.resolve(false),
    clinicHasFeature(supabase, profile!.clinic_id, "branding_custom"),
  ]);

  let shellBranding: {
    logoUrl: string | null;
    colors: ReturnType<typeof parseBrandingJson>["colors"];
  } | null = null;

  if (brandingEnabled && clinic) {
    const branding = parseBrandingJson(
      clinic.branding_json as Parameters<typeof parseBrandingJson>[0],
    );
    let logoUrl: string | null = null;
    if (branding.logoPath) {
      const { data } = await supabase.storage
        .from(CLINIC_BRANDING_BUCKET)
        .createSignedUrl(branding.logoPath, BRANDING_SIGNED_URL_TTL_SECONDS);
      logoUrl = data?.signedUrl ?? null;
    } else if (branding.logoUrl) {
      logoUrl = branding.logoUrl;
    }

    if (logoUrl || hasCustomColors(branding.colors)) {
      shellBranding = {
        logoUrl,
        colors: branding.colors,
      };
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ImpersonationBanner />
      <AppShell
        clinicName={clinic?.name ?? t("clinicFallback")}
        role={profile!.role}
        fullName={profile!.full_name}
        operatorName={operatorName}
        isOwner={profile!.role === "owner"}
        showExpenses={showExpenses}
        branding={shellBranding}
      >
        {children}
      </AppShell>
    </div>
  );
}
