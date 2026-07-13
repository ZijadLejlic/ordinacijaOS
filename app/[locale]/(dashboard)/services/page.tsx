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
  CreateServiceForm,
  ServiceSearchForm,
  ServicesTable,
} from "@/components/services/service-forms";
import { canReadServices, canWriteServices } from "@/lib/patients/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function ServicesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, status: statusParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Services");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canReadServices(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const canWrite = canWriteServices(profile!.role);
  const query = q?.trim() ?? "";
  const status =
    statusParam === "active" || statusParam === "inactive"
      ? statusParam
      : "all";

  let servicesQuery = supabase
    .from("services")
    .select(
      "id, name, code, duration_minutes, price_eur, vat_rate, location_id, is_active",
    )
    .eq("clinic_id", profile!.clinic_id)
    .order("name", { ascending: true });

  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    servicesQuery = servicesQuery.or(
      `name.ilike.%${escaped}%,code.ilike.%${escaped}%`,
    );
  }

  if (status === "active") {
    servicesQuery = servicesQuery.eq("is_active", true);
  } else if (status === "inactive") {
    servicesQuery = servicesQuery.eq("is_active", false);
  }

  const [{ data: services }, { data: locations }, { data: clinic }] =
    await Promise.all([
      servicesQuery,
      supabase
        .from("clinic_locations")
        .select("id, name")
        .eq("clinic_id", profile!.clinic_id)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("clinics")
        .select("settings_json")
        .eq("id", profile!.clinic_id)
        .single(),
    ]);

  const settings = (clinic?.settings_json ?? {}) as Record<string, Json>;
  const sharedPricelist = settings.shared_pricelist_across_locations !== false;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        {sharedPricelist ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {t("locationShared")}
          </p>
        ) : null}
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("newTitle")}</CardTitle>
            <CardDescription>{t("newDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateServiceForm
              locations={locations ?? []}
              sharedPricelist={sharedPricelist}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("search")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceSearchForm initialQuery={query} initialStatus={status} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <ServicesTable
            services={(services ?? []).map((service) => ({
              id: service.id,
              name: service.name,
              code: service.code,
              durationMinutes: service.duration_minutes,
              priceEur: Number(service.price_eur),
              vatRate: Number(service.vat_rate),
              locationId: service.location_id,
              isActive: service.is_active,
            }))}
            locations={locations ?? []}
            sharedPricelist={sharedPricelist}
            canWrite={canWrite}
          />
        </CardContent>
      </Card>
    </main>
  );
}
