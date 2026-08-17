import { createServiceClient } from "@/lib/supabase/service";
import { getClinicEntitlements } from "@/lib/entitlements";
import type { Database } from "@/lib/supabase/database.types";

export type PlatformClinicListItem = {
  id: string;
  name: string;
  status: Database["public"]["Enums"]["clinic_status"];
  trialEndsAt: string | null;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: Database["public"]["Enums"]["subscription_status"] | null;
  createdAt: string;
};

export async function listPlatformClinics(): Promise<PlatformClinicListItem[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("clinics")
    .select(
      "id, name, status, trial_ends_at, created_at, plans(code, name), clinic_subscriptions(status)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const plan = row.plans as { code: string; name: string } | null;
    const sub = row.clinic_subscriptions as {
      status: Database["public"]["Enums"]["subscription_status"];
    } | null;

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      planCode: plan?.code ?? null,
      planName: plan?.name ?? null,
      subscriptionStatus: sub?.status ?? null,
      createdAt: row.created_at,
    };
  });
}

export async function getPlatformClinicDetail(clinicId: string) {
  const service = createServiceClient();

  const { data: clinic, error } = await service
    .from("clinics")
    .select(
      "id, name, status, trial_ends_at, timezone, phone_country_default, plan_id, created_at, updated_at, plans(id, code, name), clinic_subscriptions(plan_id, status, provider, provider_customer_id, provider_subscription_id, provider_variant_id, payment_method, current_period_end)",
    )
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !clinic) return null;

  const { data: plans } = await service
    .from("plans")
    .select("id, code, name, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: owners } = await service
    .from("profiles")
    .select("id, full_name, is_active, created_at")
    .eq("clinic_id", clinicId)
    .eq("role", "owner")
    .order("created_at", { ascending: true });

  const entitlements = await getClinicEntitlements(service, clinicId);

  const plan = clinic.plans as { id: string; code: string; name: string } | null;
  const subscription = clinic.clinic_subscriptions as {
    plan_id: string;
    status: Database["public"]["Enums"]["subscription_status"];
    provider: Database["public"]["Enums"]["billing_provider"] | null;
    provider_customer_id: string | null;
    provider_subscription_id: string | null;
    provider_variant_id: string | null;
    payment_method: Database["public"]["Enums"]["billing_payment_method"] | null;
    current_period_end: string | null;
  } | null;

  return {
    clinic: {
      id: clinic.id,
      name: clinic.name,
      status: clinic.status,
      trialEndsAt: clinic.trial_ends_at,
      timezone: clinic.timezone,
      phoneCountryDefault: clinic.phone_country_default,
      planId: clinic.plan_id,
      createdAt: clinic.created_at,
      updatedAt: clinic.updated_at,
      plan,
    },
    subscription,
    plans: plans ?? [],
    owners: owners ?? [],
    entitlements,
  };
}
