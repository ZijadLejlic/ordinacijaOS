"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import {
  brandingToJson,
  parseBrandingJson,
  type ClinicBranding,
} from "@/lib/branding/parse";
import { canManageBranding } from "@/lib/branding/rbac";
import {
  CLINIC_BRANDING_BUCKET,
  convertLogoToWebp,
  logoPath,
  MAX_LOGO_SIZE_BYTES,
} from "@/lib/branding/storage";
import { asUploadBlob } from "@/lib/patients/storage";
import { assertFeature } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { updateBrandingColorsSchema } from "@/lib/validations/branding";
import { getClinicWriteBlock } from "@/lib/clinic/writable";

export type BrandingActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Parameters<typeof canManageBranding>[0];
  is_active: boolean;
};

async function requireBrandingManager() {
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

  if (!profile?.is_active || !canManageBranding(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
  if (writeBlock) {
    return { error: writeBlock, supabase, user, profile: profile as ProfileRow };
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

function revalidateBranding(locale: string) {
  revalidatePath(`/${locale}/settings/branding`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}`, "layout");
}

async function loadBranding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
): Promise<ClinicBranding> {
  const { data } = await supabase
    .from("clinics")
    .select("branding_json")
    .eq("id", clinicId)
    .maybeSingle();
  return parseBrandingJson(data?.branding_json);
}

export async function updateBrandingColorsAction(
  _prev: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const parsed = updateBrandingColorsSchema.safeParse({
    background: formData.get("background") ?? "",
    text: formData.get("text") ?? "",
    accent: formData.get("accent") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireBrandingManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "branding_custom",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const current = await loadBranding(supabase, profile.clinic_id);
  const next: ClinicBranding = {
    ...current,
    colors: {
      background: parsed.data.background,
      text: parsed.data.text,
      accent: parsed.data.accent,
    },
  };

  const { error: updateError } = await supabase
    .from("clinics")
    .update({ branding_json: brandingToJson(next) })
    .eq("id", profile.clinic_id);

  if (updateError) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "clinic.branding_colors_updated",
    payload: {
      has_background: Boolean(parsed.data.background),
      has_text: Boolean(parsed.data.text),
      has_accent: Boolean(parsed.data.accent),
    },
  });

  const locale = await getLocale();
  revalidateBranding(locale);
  return { message: "colorsSaved" };
}

export async function uploadBrandingLogoAction(
  _prev: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "invalid" };
  if (file.size > MAX_LOGO_SIZE_BYTES) return { error: "logoTooLarge" };

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  if (!allowed.includes(file.type)) return { error: "logoInvalidType" };

  const { error, supabase, user, profile } = await requireBrandingManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "branding_custom",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  let webp: Buffer;
  try {
    webp = await convertLogoToWebp(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "logoInvalidType" };
  }

  const path = logoPath(profile.clinic_id);
  const { error: uploadError } = await supabase.storage
    .from(CLINIC_BRANDING_BUCKET)
    .upload(path, asUploadBlob(webp, "image/webp"), {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) return { error: "uploadFailed" };

  const current = await loadBranding(supabase, profile.clinic_id);
  const next: ClinicBranding = {
    ...current,
    logoPath: path,
    logoUrl: null,
  };

  const { error: updateError } = await supabase
    .from("clinics")
    .update({ branding_json: brandingToJson(next) })
    .eq("id", profile.clinic_id);

  if (updateError) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "clinic.branding_logo_uploaded",
    payload: {},
  });

  const locale = await getLocale();
  revalidateBranding(locale);
  return { message: "logoUploaded" };
}

export async function removeBrandingLogoAction(
  _prev: BrandingActionState,
  _formData: FormData,
): Promise<BrandingActionState> {
  const { error, supabase, user, profile } = await requireBrandingManager();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "branding_custom",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const current = await loadBranding(supabase, profile.clinic_id);
  const path = current.logoPath ?? logoPath(profile.clinic_id);

  await supabase.storage.from(CLINIC_BRANDING_BUCKET).remove([path]);

  const next: ClinicBranding = {
    ...current,
    logoPath: null,
    logoUrl: null,
  };

  const { error: updateError } = await supabase
    .from("clinics")
    .update({ branding_json: brandingToJson(next) })
    .eq("id", profile.clinic_id);

  if (updateError) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "clinic.branding_logo_removed",
    payload: {},
  });

  const locale = await getLocale();
  revalidateBranding(locale);
  return { message: "logoRemoved" };
}
