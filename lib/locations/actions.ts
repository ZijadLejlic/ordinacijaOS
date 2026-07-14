"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { assertCanCreateLocation } from "@/lib/entitlements";
import { canManageLocations } from "@/lib/locations/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { getClinicWriteBlock } from "@/lib/clinic/writable";
import {
  createLocationSchema,
  setLocationActiveSchema,
  sharedPricelistSchema,
  updateLocationSchema,
} from "@/lib/validations/location";

export type LocationActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Parameters<typeof canManageLocations>[0];
  is_active: boolean;
};

async function requireLocationManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null as ProfileRow | null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canManageLocations(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
  if (writeBlock) {
    return { error: writeBlock, supabase, user, profile: profile as ProfileRow };
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

function revalidateLocations(locale: string) {
  revalidatePath(`/${locale}/settings/locations`);
  revalidatePath(`/${locale}/services`);
  revalidatePath(`/${locale}/calendar`);
  revalidatePath(`/${locale}/invoices`);
}

export async function createLocationAction(
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = createLocationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireLocationManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const limit = await assertCanCreateLocation(supabase, profile.clinic_id);
  if (!limit.ok) return { error: "locationLimit" };

  const { data, error: insertError } = await supabase
    .from("clinic_locations")
    .insert({
      clinic_id: profile.clinic_id,
      name: parsed.data.name,
      address: parsed.data.address,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !data) {
    if (insertError?.code === "23514") return { error: "locationLimit" };
    return { error: "createFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "location.created",
    payload: { location_id: data.id },
  });

  const locale = await getLocale();
  revalidateLocations(locale);
  return { message: "created" };
}

export async function updateLocationAction(
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = updateLocationSchema.safeParse({
    locationId: formData.get("locationId"),
    name: formData.get("name"),
    address: formData.get("address") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireLocationManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const { data, error: updateError } = await supabase
    .from("clinic_locations")
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.locationId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (updateError || !data) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "location.updated",
    payload: { location_id: parsed.data.locationId },
  });

  const locale = await getLocale();
  revalidateLocations(locale);
  return { message: "updated" };
}

export async function setLocationActiveAction(
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = setLocationActiveSchema.safeParse({
    locationId: formData.get("locationId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireLocationManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const { data: existing } = await supabase
    .from("clinic_locations")
    .select("id, is_active")
    .eq("id", parsed.data.locationId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "locationNotFound" };
  if (existing.is_active === parsed.data.isActive) {
    return {
      message: parsed.data.isActive ? "activated" : "deactivated",
    };
  }

  if (!parsed.data.isActive) {
    const { count, error: countError } = await supabase
      .from("clinic_locations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", profile.clinic_id)
      .eq("is_active", true);

    if (countError) return { error: "saveFailed" };
    if ((count ?? 0) <= 1) return { error: "lastLocation" };
  } else {
    const limit = await assertCanCreateLocation(supabase, profile.clinic_id);
    if (!limit.ok) return { error: "locationLimit" };
  }

  const { data, error: updateError } = await supabase
    .from("clinic_locations")
    .update({
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.locationId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (updateError || !data) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: parsed.data.isActive
      ? "location.activated"
      : "location.deactivated",
    payload: { location_id: parsed.data.locationId },
  });

  const locale = await getLocale();
  revalidateLocations(locale);
  return {
    message: parsed.data.isActive ? "activated" : "deactivated",
  };
}

/**
 * D16: toggle shared pricelist. When enabling shared mode, clear per-location
 * service bindings so the cjenovnik is clinic-wide again.
 */
export async function updateSharedPricelistAction(
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const parsed = sharedPricelistSchema.safeParse({
    sharedPricelistAcrossLocations:
      formData.get("sharedPricelistAcrossLocations") === "on",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireLocationManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const { data: clinic } = await supabase
    .from("clinics")
    .select("settings_json")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  const current = (clinic?.settings_json ?? {}) as Record<string, unknown>;
  const next: Json = {
    ...current,
    shared_pricelist_across_locations:
      parsed.data.sharedPricelistAcrossLocations,
  };

  const { error: clinicError } = await supabase
    .from("clinics")
    .update({ settings_json: next })
    .eq("id", profile.clinic_id);

  if (clinicError) return { error: "saveFailed" };

  if (parsed.data.sharedPricelistAcrossLocations) {
    const { error: servicesError } = await supabase
      .from("services")
      .update({ location_id: null, updated_at: new Date().toISOString() })
      .eq("clinic_id", profile.clinic_id)
      .not("location_id", "is", null);

    if (servicesError) return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "clinic.shared_pricelist_updated",
    payload: {
      shared_pricelist_across_locations:
        parsed.data.sharedPricelistAcrossLocations,
    },
  });

  const locale = await getLocale();
  revalidateLocations(locale);
  return { message: "settingsSaved" };
}
