import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import {
  parseOnboardingState,
  parseWorkingHours,
} from "@/lib/onboarding/parse";
import { canAccessOnboarding } from "@/lib/onboarding/rbac";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

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
      "role, clinic_id, practices_as_doctor, clinics(name, timezone, phone_country_default, settings_json)",
    )
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canAccessOnboarding(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const clinic = profile!.clinics as {
    name: string;
    timezone: string;
    phone_country_default: string;
    settings_json: unknown;
  } | null;

  if (!clinic) {
    redirect({ href: "/dashboard", locale });
  }

  const onboarding = parseOnboardingState(clinic!.settings_json);
  if (onboarding.completed) {
    redirect({ href: "/dashboard", locale });
  }

  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile!.clinic_id)
    .eq("is_active", true);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ImpersonationBanner />
      <OnboardingWizard
        clinicName={clinic!.name}
        timezone={clinic!.timezone || "Europe/Sarajevo"}
        phoneCountryDefault={clinic!.phone_country_default || "+387"}
        workingHours={parseWorkingHours(clinic!.settings_json)}
        onboarding={onboarding}
        serviceCount={count ?? 0}
        practicesAsDoctor={
          profile!.practices_as_doctor || !onboarding.steps.clinic
        }
      />
    </div>
  );
}
