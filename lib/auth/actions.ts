"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { publicLocalePath } from "@/i18n/path";
import { createClient } from "@/lib/supabase/server";
import { authEmailRedirectUrl } from "@/lib/auth/app-url";
import { ensureOwnerClinic } from "@/lib/auth/ensure-clinic";
import { mfaPath, resolveOwnerMfaGate } from "@/lib/auth/mfa";
import { resolveOnboardingGate } from "@/lib/onboarding/gate";
import { clearOperatorCookie } from "@/lib/operators/session";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { clearImpersonationCookie } from "@/lib/platform/session";
import { clearSentryAuthContext } from "@/lib/observability/sentry";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/auth";

async function redirectAfterAuth(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPlatformAdmin(user)) {
    redirect({ href: "/platform", locale });
  }

  const gate = await resolveOwnerMfaGate(supabase);
  if (gate !== "ok") {
    redirect({ href: mfaPath(gate), locale });
  }

  const onboardingGate = await resolveOnboardingGate(supabase);
  if (onboardingGate === "needs_onboarding") {
    redirect({ href: "/onboarding", locale });
  }

  redirect({ href: "/dashboard", locale });
}

export type AuthActionState = {
  error?: string;
  message?: string;
} | null;

function mapLoginRpcError(message: string | undefined): string | null {
  const raw = (message ?? "").toLowerCase();
  if (raw.includes("locked")) return "locked";
  return null;
}

export async function signupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    clinicName: formData.get("clinicName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const { clinicName, fullName, email, password } = parsed.data;
  const supabase = await createClient();
  const locale = await getLocale();

  // Without emailRedirectTo, GoTrue falls back to project Site URL (often localhost).
  const emailRedirectTo = authEmailRedirectUrl(
    publicLocalePath(locale, "/login"),
  );
  if (!emailRedirectTo) {
    return { error: "missingAppUrl" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      // Pending signup payload only — never used for authorization/RLS.
      data: {
        full_name: fullName,
        clinic_name: clinicName,
      },
    },
  });

  if (error) {
    const raw = error.message.toLowerCase();
    if (
      raw.includes("already registered") ||
      raw.includes("already been registered") ||
      raw.includes("user already exists")
    ) {
      return { error: "emailTaken" };
    }
    return { error: error.message };
  }

  if (!data.session) {
    return { message: "confirmEmail" };
  }

  const ensured = await ensureOwnerClinic(supabase, { clinicName, fullName });
  if (ensured.error) {
    return { error: ensured.error };
  }

  await redirectAfterAuth(locale);
  return null;
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const locale = await getLocale();
  const email = parsed.data.email;

  const { error: lockError } = await supabase.rpc("check_login_lockout", {
    p_email: email,
  });
  const lockCode = mapLoginRpcError(lockError?.message);
  if (lockCode) {
    return { error: lockCode };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await supabase.rpc("record_failed_login", { p_email: email });
    return { error: "invalidCredentials" };
  }

  await supabase.rpc("clear_login_lockout");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Platform admins have no clinic profile (D41).
  if (!isPlatformAdmin(user)) {
    const meta = user?.user_metadata ?? {};
    const clinicName =
      typeof meta.clinic_name === "string" ? meta.clinic_name : null;
    const fullName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : (user?.email ?? "Owner");

    if (clinicName) {
      const ensured = await ensureOwnerClinic(supabase, {
        clinicName,
        fullName,
      });
      if (ensured.error) {
        return { error: ensured.error };
      }
    } else {
      // Prefer SECURITY DEFINER helper — `profiles` SELECT is blocked for owners
      // at aal1 after MFA enrollment (restrictive owner_mfa_ok RLS).
      const { data: clinicId } = await supabase.rpc("current_clinic_id");
      if (!clinicId) {
        return { error: "missingClinic" };
      }
    }
  }

  await redirectAfterAuth(locale);
  return null;
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const locale = await getLocale();
  const redirectTo = authEmailRedirectUrl(
    publicLocalePath(locale, "/reset-password"),
  );
  if (!redirectTo) {
    return { error: "missingAppUrl" };
  }

  const supabase = await createClient();
  // Always show the same success copy — do not leak whether the email exists.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  return { message: "resetEmailSent" };
}

export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const mismatch = parsed.error.issues.some(
      (issue) => issue.message === "mismatch",
    );
    return { error: mismatch ? "passwordMismatch" : "invalid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "resetSessionExpired" };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    const raw = error.message.toLowerCase();
    if (raw.includes("same password") || raw.includes("different from")) {
      return { error: "passwordSameAsOld" };
    }
    return { error: error.message };
  }

  const locale = await getLocale();
  await redirectAfterAuth(locale);
  return null;
}

export async function logoutAction() {
  const supabase = await createClient();
  const locale = await getLocale();
  clearSentryAuthContext();
  await clearOperatorCookie();
  await clearImpersonationCookie();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale });
}
