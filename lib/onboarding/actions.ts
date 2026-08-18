"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { writeAuditEvent } from "@/lib/audit/log";
import {
  assertCanEnablePracticesAsDoctor,
  assertCanInviteStaff,
} from "@/lib/entitlements";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/invites/token";
import { sendStaffInviteEmail } from "@/lib/email/resend";
import {
  onboardingToJson,
  parseOnboardingState,
  parseWorkingHours,
  workingHoursToJson,
  type OnboardingState,
  type WorkingHours,
  WEEKDAYS,
} from "@/lib/onboarding/parse";
import { canAccessOnboarding } from "@/lib/onboarding/rbac";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  onboardingClinicSchema,
  onboardingInviteSchema,
  onboardingServiceSchema,
} from "@/lib/validations/onboarding";
import type { Json } from "@/lib/supabase/database.types";

export type OnboardingActionState = {
  error?: string;
  message?: string;
  inviteUrl?: string;
  step?: 1 | 2 | 3;
} | null;

async function requireOnboardingOwner() {
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

  if (!profile?.is_active || !canAccessOnboarding(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile };
}

async function loadClinicSettings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
) {
  const { data } = await supabase
    .from("clinics")
    .select("name, timezone, phone_country_default, settings_json")
    .eq("id", clinicId)
    .maybeSingle();
  return data;
}

function mergeSettings(
  current: unknown,
  patch: {
    onboarding?: OnboardingState;
    workingHours?: WorkingHours;
  },
): Json {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  if (patch.workingHours) {
    base.working_hours = workingHoursToJson(patch.workingHours);
  }
  if (patch.onboarding) {
    base.onboarding = onboardingToJson(patch.onboarding);
  }
  return base as Json;
}

function parseWorkingHoursFromForm(formData: FormData): WorkingHours {
  const hours = parseWorkingHours({});
  for (const day of WEEKDAYS) {
    hours[day] = {
      closed: formData.get(`${day}_closed`) === "on",
      open: String(formData.get(`${day}_open`) ?? hours[day].open),
      close: String(formData.get(`${day}_close`) ?? hours[day].close),
    };
  }
  return hours;
}

function revalidateOnboarding(locale: string) {
  revalidatePath(`/${locale}/onboarding`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/services`);
  revalidatePath(`/${locale}/settings/users`);
}

export async function saveOnboardingClinicAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const workingHours = parseWorkingHoursFromForm(formData);
  const parsed = onboardingClinicSchema.safeParse({
    clinicName: formData.get("clinicName"),
    timezone: formData.get("timezone"),
    phoneCountryDefault: formData.get("phoneCountryDefault"),
    workingHours,
    practicesAsDoctor: formData.get("practicesAsDoctor") === "on",
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireOnboardingOwner();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();
  const clinic = await loadClinicSettings(supabase, profile.clinic_id);
  if (!clinic) return { error: "saveFailed" };

  const onboarding = parseOnboardingState(clinic.settings_json);
  if (onboarding.completed) {
    redirect({ href: "/dashboard", locale });
  }

  const nextOnboarding: OnboardingState = {
    ...onboarding,
    step: 2,
    steps: { ...onboarding.steps, clinic: true },
  };

  if (parsed.data.practicesAsDoctor) {
    const limit = await assertCanEnablePracticesAsDoctor(
      supabase,
      profile.clinic_id,
    );
    if (!limit.ok) return { error: limit.code };
  }

  const { error: practiceError } = await supabase
    .from("profiles")
    .update({ practices_as_doctor: parsed.data.practicesAsDoctor })
    .eq("id", profile.id)
    .eq("clinic_id", profile.clinic_id);

  if (practiceError) {
    const msg = (practiceError.message ?? "").toLowerCase();
    if (msg.includes("plan_limit_doctors")) return { error: "doctorLimit" };
    return { error: "saveFailed" };
  }

  const { error } = await supabase
    .from("clinics")
    .update({
      name: parsed.data.clinicName,
      timezone: parsed.data.timezone,
      phone_country_default: parsed.data.phoneCountryDefault,
      settings_json: mergeSettings(clinic.settings_json, {
        onboarding: nextOnboarding,
        workingHours: parsed.data.workingHours,
      }),
    })
    .eq("id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "onboarding.step1_completed",
    payload: {
      step: 1,
      practices_as_doctor: parsed.data.practicesAsDoctor,
    },
  });

  revalidateOnboarding(locale);
  return { message: "clinicSaved", step: 2 };
}

export async function createOnboardingServiceAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = onboardingServiceSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") ?? "",
    durationMinutes: formData.get("durationMinutes"),
    priceEur: formData.get("priceEur"),
    vatRate: formData.get("vatRate"),
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireOnboardingOwner();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      clinic_id: profile.clinic_id,
      name: parsed.data.name,
      code: parsed.data.code || null,
      duration_minutes: parsed.data.durationMinutes,
      price_eur: parsed.data.priceEur,
      vat_rate: parsed.data.vatRate,
      location_id: null,
    })
    .select("id")
    .single();

  if (error || !service) return { error: "createFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "service.created",
    payload: { service_id: service.id, source: "onboarding" },
  });

  revalidateOnboarding(locale);
  return { message: "serviceCreated" };
}

export async function advanceOnboardingServicesAction(
  _prev: OnboardingActionState,
  _formData: FormData,
): Promise<OnboardingActionState> {
  const auth = await requireOnboardingOwner();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();
  const clinic = await loadClinicSettings(supabase, profile.clinic_id);
  if (!clinic) return { error: "saveFailed" };

  const onboarding = parseOnboardingState(clinic.settings_json);
  if (onboarding.completed) {
    redirect({ href: "/dashboard", locale });
  }

  const { count, error: countError } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id)
    .eq("is_active", true);

  if (countError) return { error: "saveFailed" };
  if (!count || count < 1) return { error: "needService" };

  const nextOnboarding: OnboardingState = {
    ...onboarding,
    step: 3,
    steps: { ...onboarding.steps, services: true },
  };

  const { error } = await supabase
    .from("clinics")
    .update({
      settings_json: mergeSettings(clinic.settings_json, {
        onboarding: nextOnboarding,
      }),
    })
    .eq("id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "onboarding.step2_completed",
    payload: { step: 2, service_count: count },
  });

  revalidateOnboarding(locale);
  return { message: "servicesDone", step: 3 };
}

export async function inviteOnboardingStaffAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = onboardingInviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "invalid" };

  const auth = await requireOnboardingOwner();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();
  const email = parsed.data.email.toLowerCase();

  const limit = await assertCanInviteStaff(
    supabase,
    profile.clinic_id,
    parsed.data.role,
  );
  if (!limit.ok) return { error: limit.code };

  const service = createServiceClient();
  const { data: emailTaken, error: emailCheckError } = await service.rpc(
    "auth_email_exists",
    { p_email: email },
  );
  if (emailCheckError) return { error: "inviteFailed" };
  if (emailTaken) return { error: "emailTaken" };

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);

  const { data: invite, error: insertError } = await supabase
    .from("clinic_invites")
    .insert({
      clinic_id: profile.clinic_id,
      email,
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      token_hash: tokenHash,
      expires_at: inviteExpiresAt(),
      invited_by: profile.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !invite) {
    if (insertError?.code === "23505") return { error: "inviteExists" };
    return { error: "inviteFailed" };
  }

  const clinic = await loadClinicSettings(supabase, profile.clinic_id);
  if (!clinic) return { error: "inviteFailed" };

  try {
    const sent = await sendStaffInviteEmail({
      to: email,
      fullName: parsed.data.fullName,
      clinicName: clinic.name,
      role: parsed.data.role,
      token,
      locale,
    });

    await writeAuditEvent(supabase, {
      clinicId: profile.clinic_id,
      actorUserId: user.id,
      eventName: "invite.created",
      payload: {
        invite_id: invite.id,
        role: parsed.data.role,
        source: "onboarding",
      },
    });

    const onboarding = parseOnboardingState(clinic.settings_json);
    const completedAt = new Date().toISOString();
    const nextOnboarding: OnboardingState = {
      ...onboarding,
      completed: true,
      step: 3,
      steps: { clinic: true, services: true, invite: true },
      completedAt,
      skippedInvite: false,
    };

    await supabase
      .from("clinics")
      .update({
        settings_json: mergeSettings(clinic.settings_json, {
          onboarding: nextOnboarding,
        }),
      })
      .eq("id", profile.clinic_id);

    await writeAuditEvent(supabase, {
      clinicId: profile.clinic_id,
      actorUserId: user.id,
      eventName: "onboarding.completed",
      payload: { skipped_invite: false },
    });

    revalidateOnboarding(locale);
    redirect({ href: "/dashboard", locale });
    return {
      message: "inviteSent",
      inviteUrl:
        process.env.NODE_ENV !== "production" ? sent.inviteUrl : undefined,
    };
  } catch {
    await supabase
      .from("clinic_invites")
      .update({ status: "revoked" })
      .eq("id", invite.id);
    return { error: "emailFailed" };
  }
}

export async function skipOnboardingInviteAction(
  _prev: OnboardingActionState,
  _formData: FormData,
): Promise<OnboardingActionState> {
  const auth = await requireOnboardingOwner();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "unauthorized" };
  }

  const { supabase, user, profile } = auth;
  const locale = await getLocale();
  const clinic = await loadClinicSettings(supabase, profile.clinic_id);
  if (!clinic) return { error: "saveFailed" };

  const onboarding = parseOnboardingState(clinic.settings_json);
  if (!onboarding.steps.clinic || !onboarding.steps.services) {
    return { error: "incompleteSteps" };
  }

  const completedAt = new Date().toISOString();
  const nextOnboarding: OnboardingState = {
    ...onboarding,
    completed: true,
    step: 3,
    steps: { ...onboarding.steps, invite: true },
    completedAt,
    skippedInvite: true,
  };

  const { error } = await supabase
    .from("clinics")
    .update({
      settings_json: mergeSettings(clinic.settings_json, {
        onboarding: nextOnboarding,
      }),
    })
    .eq("id", profile.clinic_id);

  if (error) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "onboarding.completed",
    payload: { skipped_invite: true },
  });

  revalidateOnboarding(locale);
  redirect({ href: "/dashboard", locale });
  return { message: "completed" };
}