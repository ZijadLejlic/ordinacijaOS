"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { writeAuditEvent } from "@/lib/audit/log";
import { isPlatformAdmin } from "@/lib/platform/admin";
import {
  clearImpersonationCookie,
  getImpersonationFromCookie,
  setImpersonationCookie,
} from "@/lib/platform/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  startImpersonationSchema,
  updateClinicPlanSchema,
  updateClinicStatusSchema,
  updateSubscriptionStatusSchema,
} from "@/lib/validations/platform";

export type PlatformActionState = {
  error?: string;
  message?: string;
} | null;

async function requirePlatformAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" as const, user: null, supabase };
  }
  if (!isPlatformAdmin(user)) {
    return { error: "forbidden" as const, user: null, supabase };
  }
  return { error: null, user, supabase };
}

async function switchSessionToEmail(email: string) {
  const service = createServiceClient();
  const { data: linkData, error: linkError } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData.properties?.hashed_token) {
    return { error: linkError?.message ?? "sessionSwitchFailed" };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });

  if (verifyError) {
    return { error: verifyError.message };
  }

  return { error: null };
}

export async function updateClinicStatusAction(
  _prev: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  const parsed = updateClinicStatusSchema.safeParse({
    clinicId: formData.get("clinicId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  const gate = await requirePlatformAdminUser();
  if (gate.error || !gate.user) return { error: gate.error ?? "unauthorized" };

  const service = createServiceClient();
  const locale = await getLocale();

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.clinic_status_update",
    payload: {
      status: parsed.data.status,
      phase: "requested",
    },
    operatorId: null,
  });

  const { error } = await service
    .from("clinics")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.clinicId);

  if (error) {
    await writeAuditEvent(service, {
      clinicId: parsed.data.clinicId,
      actorUserId: gate.user.id,
      eventName: "platform.clinic_status_update",
      payload: {
        status: parsed.data.status,
        phase: "failed",
        error: error.message,
      },
      operatorId: null,
    });
    return { error: "updateFailed" };
  }

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.clinic_status_update",
    payload: {
      status: parsed.data.status,
      phase: "succeeded",
    },
    operatorId: null,
  });

  revalidatePath(`/${locale}/platform/clinics/${parsed.data.clinicId}`);
  revalidatePath(`/${locale}/platform`);
  return { message: "statusUpdated" };
}

export async function updateClinicPlanAction(
  _prev: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  const parsed = updateClinicPlanSchema.safeParse({
    clinicId: formData.get("clinicId"),
    planId: formData.get("planId"),
  });
  if (!parsed.success) return { error: "invalid" };

  const gate = await requirePlatformAdminUser();
  if (gate.error || !gate.user) return { error: gate.error ?? "unauthorized" };

  const service = createServiceClient();
  const locale = await getLocale();

  const { data: plan } = await service
    .from("plans")
    .select("id, code")
    .eq("id", parsed.data.planId)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) return { error: "planNotFound" };

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.clinic_plan_update",
    payload: {
      plan_id: plan.id,
      plan_code: plan.code,
      phase: "requested",
    },
    operatorId: null,
  });

  const { error: clinicError } = await service
    .from("clinics")
    .update({ plan_id: plan.id })
    .eq("id", parsed.data.clinicId);

  if (clinicError) {
    return { error: "updateFailed" };
  }

  const { error: subError } = await service
    .from("clinic_subscriptions")
    .update({ plan_id: plan.id })
    .eq("clinic_id", parsed.data.clinicId);

  if (subError) {
    await writeAuditEvent(service, {
      clinicId: parsed.data.clinicId,
      actorUserId: gate.user.id,
      eventName: "platform.clinic_plan_update",
      payload: {
        plan_id: plan.id,
        plan_code: plan.code,
        phase: "failed",
        error: subError.message,
      },
      operatorId: null,
    });
    return { error: "updateFailed" };
  }

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.clinic_plan_update",
    payload: {
      plan_id: plan.id,
      plan_code: plan.code,
      phase: "succeeded",
    },
    operatorId: null,
  });

  revalidatePath(`/${locale}/platform/clinics/${parsed.data.clinicId}`);
  revalidatePath(`/${locale}/platform`);
  return { message: "planUpdated" };
}

export async function updateSubscriptionStatusAction(
  _prev: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  const parsed = updateSubscriptionStatusSchema.safeParse({
    clinicId: formData.get("clinicId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  const gate = await requirePlatformAdminUser();
  if (gate.error || !gate.user) return { error: gate.error ?? "unauthorized" };

  const service = createServiceClient();
  const locale = await getLocale();

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.subscription_status_update",
    payload: {
      status: parsed.data.status,
      phase: "requested",
    },
    operatorId: null,
  });

  const { error } = await service
    .from("clinic_subscriptions")
    .update({ status: parsed.data.status })
    .eq("clinic_id", parsed.data.clinicId);

  if (error) {
    await writeAuditEvent(service, {
      clinicId: parsed.data.clinicId,
      actorUserId: gate.user.id,
      eventName: "platform.subscription_status_update",
      payload: {
        status: parsed.data.status,
        phase: "failed",
        error: error.message,
      },
      operatorId: null,
    });
    return { error: "updateFailed" };
  }

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.subscription_status_update",
    payload: {
      status: parsed.data.status,
      phase: "succeeded",
    },
    operatorId: null,
  });

  revalidatePath(`/${locale}/platform/clinics/${parsed.data.clinicId}`);
  return { message: "subscriptionUpdated" };
}

/**
 * Start audited clinic-owner impersonation (D41).
 * Session switches via Auth Admin magic link; exit restores platform admin.
 */
export async function startImpersonationAction(
  _prev: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  const parsed = startImpersonationSchema.safeParse({
    clinicId: formData.get("clinicId"),
  });
  if (!parsed.success) return { error: "invalid" };

  const gate = await requirePlatformAdminUser();
  if (gate.error || !gate.user) return { error: gate.error ?? "unauthorized" };
  if (!gate.user.email) return { error: "missingAdminEmail" };

  const existing = await getImpersonationFromCookie();
  if (existing) return { error: "alreadyImpersonating" };

  const service = createServiceClient();
  const locale = await getLocale();

  const { data: owner } = await service
    .from("profiles")
    .select("id")
    .eq("clinic_id", parsed.data.clinicId)
    .eq("role", "owner")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!owner) return { error: "ownerNotFound" };

  const { data: ownerAuth, error: ownerAuthError } =
    await service.auth.admin.getUserById(owner.id);

  if (ownerAuthError || !ownerAuth.user?.email) {
    return { error: "ownerNotFound" };
  }

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.impersonation_start",
    payload: {
      target_user_id: owner.id,
      phase: "requested",
    },
    operatorId: null,
  });

  const switched = await switchSessionToEmail(ownerAuth.user.email);
  if (switched.error) {
    await writeAuditEvent(service, {
      clinicId: parsed.data.clinicId,
      actorUserId: gate.user.id,
      eventName: "platform.impersonation_start",
      payload: {
        target_user_id: owner.id,
        phase: "failed",
        error: switched.error,
      },
      operatorId: null,
    });
    return { error: "sessionSwitchFailed" };
  }

  await setImpersonationCookie({
    adminUserId: gate.user.id,
    adminEmail: gate.user.email,
    clinicId: parsed.data.clinicId,
    targetUserId: owner.id,
    startedAt: new Date().toISOString(),
  });

  await writeAuditEvent(service, {
    clinicId: parsed.data.clinicId,
    actorUserId: gate.user.id,
    eventName: "platform.impersonation_start",
    payload: {
      target_user_id: owner.id,
      phase: "succeeded",
    },
    operatorId: null,
  });

  redirect({ href: "/dashboard", locale });
  return null;
}

export async function stopImpersonationAction(): Promise<void> {
  const payload = await getImpersonationFromCookie();
  if (!payload) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== payload.targetUserId) {
    await clearImpersonationCookie();
    return;
  }

  const service = createServiceClient();
  const { data: adminAuth, error: adminError } =
    await service.auth.admin.getUserById(payload.adminUserId);

  if (adminError || !adminAuth.user || !isPlatformAdmin(adminAuth.user)) {
    await clearImpersonationCookie();
    return;
  }

  const locale = await getLocale();
  const clinicId = payload.clinicId;

  await writeAuditEvent(service, {
    clinicId,
    actorUserId: payload.adminUserId,
    eventName: "platform.impersonation_stop",
    payload: {
      target_user_id: payload.targetUserId,
      phase: "requested",
    },
    operatorId: null,
  });

  const switched = await switchSessionToEmail(
    adminAuth.user.email ?? payload.adminEmail,
  );

  if (switched.error) {
    await writeAuditEvent(service, {
      clinicId,
      actorUserId: payload.adminUserId,
      eventName: "platform.impersonation_stop",
      payload: {
        target_user_id: payload.targetUserId,
        phase: "failed",
        error: switched.error,
      },
      operatorId: null,
    });
    return;
  }

  await clearImpersonationCookie();

  await writeAuditEvent(service, {
    clinicId,
    actorUserId: payload.adminUserId,
    eventName: "platform.impersonation_stop",
    payload: {
      target_user_id: payload.targetUserId,
      phase: "succeeded",
    },
    operatorId: null,
  });

  redirect({ href: `/platform/clinics/${clinicId}`, locale });
}
