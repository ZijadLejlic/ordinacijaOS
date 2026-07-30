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
  CreateLocationForm,
  LocationsTable,
  SharedPricelistForm,
} from "@/components/locations/location-forms";
import { getClinicLimits } from "@/lib/entitlements";
import { canManageLocations } from "@/lib/locations/rbac";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsLocationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Locations");
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

  if (!profile || !canManageLocations(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const [{ data: locations }, { data: clinic }, limits] = await Promise.all([
    supabase
      .from("clinic_locations")
      .select("id, name, address, is_active")
      .eq("clinic_id", profile!.clinic_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("clinics")
      .select("settings_json")
      .eq("id", profile!.clinic_id)
      .maybeSingle(),
    getClinicLimits(supabase, profile!.clinic_id),
  ]);

  const settings = (clinic?.settings_json ?? {}) as Record<string, Json>;
  const sharedPricelist = settings.shared_pricelist_across_locations !== false;

  const rows = (locations ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    isActive: row.is_active,
  }));
  const activeCount = rows.filter((r) => r.isActive).length;
  const locationLimit = limits.locations;
  const canCreate =
    locationLimit === null || activeCount < locationLimit;
  const limitLabel =
    locationLimit === null ? t("limitUnlimited") : String(locationLimit);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t("usage", { used: activeCount, limit: limitLabel })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sharedCardTitle")}</CardTitle>
          <CardDescription>{t("sharedCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SharedPricelistForm sharedPricelist={sharedPricelist} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("newTitle")}</CardTitle>
          <CardDescription>{t("newDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateLocationForm canCreate={canCreate} limitLabel={limitLabel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationsTable locations={rows} activeCount={activeCount} />
        </CardContent>
      </Card>
    </main>
  );
}
