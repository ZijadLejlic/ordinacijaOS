import { Suspense, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ClinicTelemetry } from "@/components/analytics/clinic-telemetry";
import { AppShell } from "@/components/dashboard/app-shell";
import { DeferredClinicLogo } from "@/components/dashboard/deferred-clinic-logo";
import {
  CrmNavBadge,
  InventoryNavBadge,
} from "@/components/dashboard/deferred-nav-badges";
import { ClinicReadonlyBanner } from "@/components/clinic/readonly-banner";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { setSentryAuthContext } from "@/lib/observability/sentry";
import {
  hasCustomColors,
  parseBrandingJson,
} from "@/lib/branding/parse";
import { BRAND_LOGO } from "@/lib/brand/constants";
import { getClinicEntitlements } from "@/lib/entitlements";
import { canAccessCrm } from "@/lib/crm/rbac";
import { canReadConsentForms } from "@/lib/consent/rbac";
import { canAccessExpenses } from "@/lib/expenses/rbac";
import { canAccessInventory } from "@/lib/inventory/rbac";
import { getOperatorIdFromCookie } from "@/lib/operators/session";
import { getClinicContext } from "@/lib/supabase/clinic-context";
import { createClient } from "@/lib/supabase/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations("Nav");

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { user, profile, clinic } = ctx!;

  // Server-side Sentry scope for this request (user.id + tags only — D33).
  setSentryAuthContext({
    userId: user.id,
    clinicId: profile.clinic_id,
    role: profile.role,
  });

  const supabase = await createClient();
  const operatorId = await getOperatorIdFromCookie();
  const entitlementsPromise = getClinicEntitlements(
    supabase,
    profile.clinic_id,
  );

  const [operatorResult, entitlements] = await Promise.all([
    operatorId
      ? supabase
          .from("clinic_operators")
          .select("display_name")
          .eq("id", operatorId)
          .maybeSingle()
      : Promise.resolve({ data: null as { display_name: string } | null }),
    entitlementsPromise,
  ]);

  const operatorName = operatorResult.data?.display_name ?? null;

  const showExpenses =
    canAccessExpenses(profile.role) &&
    entitlements.features.expenses_reports_excel.enabled;
  const brandingEnabled = entitlements.features.branding_custom.enabled;
  const showCrm =
    canAccessCrm(profile.role) && entitlements.features.crm_light.enabled;
  const showConsent =
    canReadConsentForms(profile.role) &&
    entitlements.features.consent_draw_sign.enabled;
  const showInventory =
    canAccessInventory(profile.role) &&
    entitlements.features.inventory_basic.enabled;

  const clinicName = clinic?.name ?? t("clinicFallback");

  let shellBranding: {
    colors: ReturnType<typeof parseBrandingJson>["colors"];
    logo?: ReactNode;
  } | null = null;

  if (brandingEnabled && clinic) {
    const branding = parseBrandingJson(clinic.branding_json);
    const colors = branding.colors;
    const hasColors = hasCustomColors(colors);

    let logo: ReactNode = null;
    if (branding.logoPath) {
      logo = (
        <Suspense
          fallback={
            // eslint-disable-next-line @next/next/no-img-element -- static public asset
            <img
              src={BRAND_LOGO.mark}
              alt=""
              className="h-8 w-8 shrink-0 object-contain"
            />
          }
        >
          <DeferredClinicLogo logoPath={branding.logoPath} alt={clinicName} />
        </Suspense>
      );
    } else if (branding.logoUrl) {
      logo = (
        // eslint-disable-next-line @next/next/no-img-element -- legacy absolute URL
        <img
          src={branding.logoUrl}
          alt={clinicName}
          className="h-8 w-8 shrink-0 rounded object-contain"
        />
      );
    }

    if (logo || hasColors) {
      shellBranding = { colors, logo: logo ?? undefined };
    }
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="flex min-h-full flex-1 flex-col">
        <ImpersonationBanner />
        {clinic ? (
          <ClinicReadonlyBanner
            status={clinic.status}
            graceEndsAt={clinic.grace_ends_at}
            isOwner={profile.role === "owner"}
            isDemo={clinic.is_demo}
          />
        ) : null}
        <AppShell
          clinicName={clinicName}
          role={profile.role}
          fullName={profile.full_name}
          operatorName={operatorName}
          isOwner={profile.role === "owner"}
          showExpenses={showExpenses}
          showInventory={showInventory}
          inventoryBadge={
            showInventory ? (
              <Suspense fallback={null}>
                <InventoryNavBadge clinicId={profile.clinic_id} />
              </Suspense>
            ) : null
          }
          showCrm={showCrm}
          crmBadge={
            showCrm ? (
              <Suspense fallback={null}>
                <CrmNavBadge clinicId={profile.clinic_id} />
              </Suspense>
            ) : null
          }
          showConsent={showConsent}
          branding={shellBranding}
        >
          {profile.clinic_id && profile.role ? (
            <ClinicTelemetry
              userId={user.id}
              clinicId={profile.clinic_id}
              role={profile.role}
              isDemo={clinic?.is_demo === true}
            />
          ) : null}
          {children}
        </AppShell>
      </div>
    </NextIntlClientProvider>
  );
}
