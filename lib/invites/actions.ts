"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { assertCanInviteStaff } from "@/lib/entitlements/limits";
import {
  sendPasswordResetEmail,
  sendStaffInviteEmail,
} from "@/lib/email/resend";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/invites/token";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  acceptInviteSchema,
  createInviteSchema,
} from "@/lib/validations/invite";
import type { Database } from "@/lib/supabase/database.types";
import { getClinicWriteBlock } from "@/lib/clinic/writable";

type AppRole = Database["public"]["Enums"]["app_role"];

export type InviteActionState = {
  error?: string;
  message?: string;
  inviteUrl?: string;
} | null;

async function requireOwnerProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" as const, supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || profile.role !== "owner") {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
  if (writeBlock) {
    return { error: writeBlock, supabase, user, profile };
  }

  return { error: null, supabase, user, profile };
}

async function loadClinicName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
) {
  const { data } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .single();
  return data?.name ?? "Ordinacija";
}

export async function createInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = createInviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const owner = await requireOwnerProfile();
  if (owner.error || !owner.profile) {
    return { error: owner.error ?? "forbidden" };
  }

  const { supabase, user, profile } = owner;
  const locale = await getLocale();
  const email = parsed.data.email.toLowerCase();

  const limit = await assertCanInviteStaff(
    supabase,
    profile.clinic_id,
    parsed.data.role,
  );
  if (!limit.ok) {
    return { error: limit.code };
  }

  const service = createServiceClient();
  const { data: emailTaken, error: emailCheckError } = await service.rpc(
    "auth_email_exists",
    { p_email: email },
  );
  if (emailCheckError) {
    return { error: emailCheckError.message };
  }
  if (emailTaken) {
    return { error: "emailTaken" };
  }

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
    if (insertError?.code === "23505") {
      return { error: "inviteExists" };
    }
    return { error: insertError?.message ?? "inviteFailed" };
  }

  const clinicName = await loadClinicName(supabase, profile.clinic_id);

  try {
    const sent = await sendStaffInviteEmail({
      to: email,
      fullName: parsed.data.fullName,
      clinicName,
      role: parsed.data.role,
      token,
      locale,
    });

    await supabase.from("audit_events").insert({
      clinic_id: profile.clinic_id,
      actor_user_id: user!.id,
      event_name: "invite.created",
      payload_json: {
        invite_id: invite.id,
        role: parsed.data.role,
      },
    });

    revalidatePath(`/${locale}/settings/users`);
    return {
      message: "inviteSent",
      inviteUrl:
        process.env.NODE_ENV !== "production" ? sent.inviteUrl : undefined,
    };
  } catch (err) {
    await supabase
      .from("clinic_invites")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    return {
      error: err instanceof Error ? err.message : "emailFailed",
    };
  }
}

export async function resendInviteAction(
  inviteId: string,
): Promise<InviteActionState> {
  const owner = await requireOwnerProfile();
  if (owner.error || !owner.profile) {
    return { error: owner.error ?? "forbidden" };
  }

  const { supabase, user, profile } = owner;
  const locale = await getLocale();

  const { data: invite } = await supabase
    .from("clinic_invites")
    .select("*")
    .eq("id", inviteId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!invite || invite.status !== "pending") {
    return { error: "inviteNotFound" };
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from("clinic_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    return { error: "inviteExpired" };
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);

  const { error: updateError } = await supabase
    .from("clinic_invites")
    .update({
      token_hash: tokenHash,
      expires_at: inviteExpiresAt(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const clinicName = await loadClinicName(supabase, profile.clinic_id);

  try {
    const sent = await sendStaffInviteEmail({
      to: invite.email,
      fullName: invite.full_name,
      clinicName,
      role: invite.role,
      token,
      locale,
    });

    await supabase.from("audit_events").insert({
      clinic_id: profile.clinic_id,
      actor_user_id: user!.id,
      event_name: "invite.resent",
      payload_json: { invite_id: invite.id },
    });

    revalidatePath(`/${locale}/settings/users`);
    return {
      message: "inviteSent",
      inviteUrl:
        process.env.NODE_ENV !== "production" ? sent.inviteUrl : undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "emailFailed",
    };
  }
}

export async function revokeInviteAction(
  inviteId: string,
): Promise<InviteActionState> {
  const owner = await requireOwnerProfile();
  if (owner.error || !owner.profile) {
    return { error: owner.error ?? "forbidden" };
  }

  const { supabase, user, profile } = owner;
  const locale = await getLocale();

  const { data: invite, error } = await supabase
    .from("clinic_invites")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !invite) {
    return { error: error?.message ?? "inviteNotFound" };
  }

  await supabase.from("audit_events").insert({
    clinic_id: profile.clinic_id,
    actor_user_id: user!.id,
    event_name: "invite.revoked",
    payload_json: { invite_id: invite.id },
  });

  revalidatePath(`/${locale}/settings/users`);
  return { message: "inviteRevoked" };
}

export async function deactivateUserAction(
  profileId: string,
): Promise<InviteActionState> {
  const owner = await requireOwnerProfile();
  if (owner.error || !owner.profile) {
    return { error: owner.error ?? "forbidden" };
  }

  if (profileId === owner.profile.id) {
    return { error: "cannotDeactivateSelf" };
  }

  const { supabase, user, profile } = owner;
  const locale = await getLocale();

  const { data: target, error } = await supabase
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .eq("clinic_id", profile.clinic_id)
    .neq("role", "owner")
    .select("id")
    .maybeSingle();

  if (error || !target) {
    return { error: error?.message ?? "userNotFound" };
  }

  const service = createServiceClient();
  await service.auth.admin.signOut(profileId, "global");

  await supabase.from("audit_events").insert({
    clinic_id: profile.clinic_id,
    actor_user_id: user!.id,
    event_name: "user.deactivated",
    payload_json: { profile_id: profileId },
  });

  revalidatePath(`/${locale}/settings/users`);
  return { message: "userDeactivated" };
}

export async function forceLogoutUserAction(
  profileId: string,
): Promise<InviteActionState> {
  const owner = await requireOwnerProfile();
  if (owner.error || !owner.profile) {
    return { error: owner.error ?? "forbidden" };
  }

  const { supabase, user, profile } = owner;
  const locale = await getLocale();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!target || target.role === "owner") {
    return { error: "userNotFound" };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.signOut(profileId, "global");
  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_events").insert({
    clinic_id: profile.clinic_id,
    actor_user_id: user!.id,
    event_name: "user.force_logout",
    payload_json: { profile_id: profileId },
  });

  revalidatePath(`/${locale}/settings/users`);
  return { message: "userLoggedOut" };
}

export async function resetUserPasswordAction(
  profileId: string,
): Promise<InviteActionState> {
  const owner = await requireOwnerProfile();
  if (owner.error || !owner.profile) {
    return { error: owner.error ?? "forbidden" };
  }

  const { supabase, user, profile } = owner;
  const locale = await getLocale();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", profileId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!target || target.role === "owner") {
    return { error: "userNotFound" };
  }

  const service = createServiceClient();
  const { data: authUser, error: getError } =
    await service.auth.admin.getUserById(profileId);

  if (getError || !authUser.user?.email) {
    return { error: getError?.message ?? "userNotFound" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    return { error: "missingAppUrl" };
  }

  const { data: linkData, error: linkError } =
    await service.auth.admin.generateLink({
      type: "recovery",
      email: authUser.user.email,
      options: {
        redirectTo: `${appUrl}/${locale}/login`,
      },
    });

  if (linkError || !linkData.properties?.action_link) {
    return { error: linkError?.message ?? "resetFailed" };
  }

  await supabase.from("audit_events").insert({
    clinic_id: profile.clinic_id,
    actor_user_id: user!.id,
    event_name: "user.password_reset_requested",
    payload_json: {
      profile_id: profileId,
      status: "requested",
    },
  });

  const clinicName = await loadClinicName(supabase, profile.clinic_id);

  try {
    await sendPasswordResetEmail({
      to: authUser.user.email,
      fullName: target.full_name,
      clinicName,
      resetUrl: linkData.properties.action_link,
    });
  } catch (err) {
    await supabase.from("audit_events").insert({
      clinic_id: profile.clinic_id,
      actor_user_id: user!.id,
      event_name: "user.password_reset_requested",
      payload_json: {
        profile_id: profileId,
        status: "email_failed",
        error: err instanceof Error ? err.message : "emailFailed",
      },
    });
    return {
      error: err instanceof Error ? err.message : "emailFailed",
    };
  }

  revalidatePath(`/${locale}/settings/users`);
  return { message: "resetSent" };
}

export async function acceptInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const locale = await getLocale();
  const tokenHash = hashInviteToken(parsed.data.token);
  const service = createServiceClient();

  const { data: peeked, error: peekError } = await service.rpc(
    "peek_clinic_invite",
    { p_token_hash: tokenHash },
  );

  if (peekError) {
    return { error: peekError.message };
  }

  const invite = peeked?.[0];
  if (!invite || invite.status !== "pending") {
    return { error: "inviteInvalid" };
  }

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email: invite.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: invite.full_name,
      },
    });

  if (createError || !created.user) {
    return { error: createError?.message ?? "acceptFailed" };
  }

  const { error: acceptError } = await service.rpc("accept_clinic_invite", {
    p_token_hash: tokenHash,
    p_user_id: created.user.id,
  });

  if (acceptError) {
    await service.auth.admin.deleteUser(created.user.id);
    return { error: acceptError.message };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  });

  if (signInError) {
    return { error: signInError.message };
  }

  redirect({ href: "/dashboard", locale });
  return null;
}

export type PeekedInvite = {
  clinicName: string;
  email: string;
  fullName: string;
  role: AppRole;
  status: Database["public"]["Enums"]["invite_status"];
} | null;

export async function peekInvite(token: string): Promise<PeekedInvite> {
  if (!token || token.length < 20) return null;

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("peek_clinic_invite", {
      p_token_hash: hashInviteToken(token),
    });

    if (error || !data?.[0]) return null;

    const row = data[0];
    return {
      clinicName: row.clinic_name,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
    };
  } catch {
    return null;
  }
}
