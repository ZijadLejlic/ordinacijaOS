"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOwnerClinic } from "@/lib/auth/ensure-clinic";
import { mfaPath, resolveOwnerMfaGate } from "@/lib/auth/mfa";
import { clearOperatorCookie } from "@/lib/operators/session";
import { loginSchema, signupSchema } from "@/lib/validations/auth";

async function redirectAfterAuth(locale: string) {
  const supabase = await createClient();
  const gate = await resolveOwnerMfaGate(supabase);
  if (gate === "ok") {
    redirect({ href: "/dashboard", locale });
  } else {
    redirect({ href: mfaPath(gate), locale });
  }
}

export type AuthActionState = {
  error?: string;
  message?: string;
} | null;

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Pending signup payload only — never used for authorization/RLS.
      data: {
        full_name: fullName,
        clinic_name: clinicName,
      },
    },
  });

  if (error) {
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

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .maybeSingle();

    if (!profile) {
      return { error: "missingClinic" };
    }
  }

  await redirectAfterAuth(locale);
  return null;
}

export async function logoutAction() {
  const supabase = await createClient();
  const locale = await getLocale();
  await clearOperatorCookie();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale });
}
