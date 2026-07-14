"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { canWriteServices } from "@/lib/patients/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceSchema,
  updateServiceSchema,
} from "@/lib/validations/service";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getClinicWriteBlock } from "@/lib/clinic/writable";

type AppRole = Database["public"]["Enums"]["app_role"];

export type ServiceActionState = {
  error?: string;
  message?: string;
} | null;

async function requireClinicMember(allowedRoles: readonly AppRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !allowedRoles.includes(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
  if (writeBlock) {
    return { error: writeBlock, supabase, user, profile };
  }

  return { error: null, supabase, user, profile };
}

/** D16: shared pricelist across locations (default true) unless clinic opts out. */
async function resolveLocationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  requestedLocationId: string,
): Promise<string | null> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("settings_json")
    .eq("id", clinicId)
    .single();

  const settings = (clinic?.settings_json ?? {}) as Record<string, Json>;
  const sharedPricelist = settings.shared_pricelist_across_locations !== false;

  if (sharedPricelist || !requestedLocationId) {
    return null;
  }

  const { data: location } = await supabase
    .from("clinic_locations")
    .select("id")
    .eq("id", requestedLocationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return location?.id ?? null;
}

export async function createServiceAction(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") ?? "",
    durationMinutes: formData.get("durationMinutes"),
    priceEur: formData.get("priceEur"),
    vatRate: formData.get("vatRate"),
    locationId: formData.get("locationId") ?? "",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireClinicMember(["owner"]);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWriteServices(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const locationId = await resolveLocationId(
    supabase,
    profile.clinic_id,
    parsed.data.locationId ?? "",
  );

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      clinic_id: profile.clinic_id,
      name: parsed.data.name,
      code: parsed.data.code || null,
      duration_minutes: parsed.data.durationMinutes,
      price_eur: parsed.data.priceEur,
      vat_rate: parsed.data.vatRate,
      location_id: locationId,
    })
    .select("id")
    .single();

  if (error || !service) {
    return { error: "createFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "service.created",
    payload: { service_id: service.id },
  });

  revalidatePath(`/${locale}/services`);
  return { message: "serviceCreated" };
}

export async function updateServiceAction(
  serviceId: string,
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const parsed = updateServiceSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") ?? "",
    durationMinutes: formData.get("durationMinutes"),
    priceEur: formData.get("priceEur"),
    vatRate: formData.get("vatRate"),
    locationId: formData.get("locationId") ?? "",
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const auth = await requireClinicMember(["owner"]);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWriteServices(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const locationId = await resolveLocationId(
    supabase,
    profile.clinic_id,
    parsed.data.locationId ?? "",
  );

  const { data: updated, error } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      code: parsed.data.code || null,
      duration_minutes: parsed.data.durationMinutes,
      price_eur: parsed.data.priceEur,
      vat_rate: parsed.data.vatRate,
      location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", serviceId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: "service.updated",
    payload: { service_id: serviceId },
  });

  revalidatePath(`/${locale}/services`);
  return { message: "serviceUpdated" };
}

export async function setServiceActiveAction(
  serviceId: string,
  isActive: boolean,
): Promise<ServiceActionState> {
  const auth = await requireClinicMember(["owner"]);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "forbidden" };
  }
  if (!canWriteServices(auth.profile.role)) {
    return { error: "forbidden" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: updated, error } = await supabase
    .from("services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", serviceId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { error: "saveFailed" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user!.id,
    eventName: isActive ? "service.activated" : "service.deactivated",
    payload: { service_id: serviceId },
  });

  revalidatePath(`/${locale}/services`);
  return { message: isActive ? "serviceActivated" : "serviceDeactivated" };
}
