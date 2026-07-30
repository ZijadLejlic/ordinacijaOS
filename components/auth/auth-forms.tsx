"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import {
  forgotPasswordAction,
  loginAction,
  signupAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/lib/auth/actions";

function mapAuthError(
  t: ReturnType<typeof useTranslations<"Auth">>,
  state: AuthActionState,
) {
  if (!state) return null;
  if (state.message === "confirmEmail") return t("confirmEmail");
  if (state.message === "resetEmailSent") return t("resetEmailSent");
  if (state.error === "invalid") return t("invalid");
  if (state.error === "invalidCredentials") return t("invalidCredentials");
  if (state.error === "locked") return t("locked");
  if (state.error === "missingClinic") return t("missingClinic");
  if (state.error === "emailTaken") return t("emailTaken");
  if (state.error === "missingAppUrl") return t("missingAppUrl");
  if (state.error === "passwordMismatch") return t("passwordMismatch");
  if (state.error === "resetSessionExpired") return t("resetSessionExpired");
  if (state.error === "passwordSameAsOld") return t("passwordSameAsOld");
  if (state.error) return state.error;
  return null;
}

export function SignupForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(signupAction, null);
  const error = mapAuthError(t, state);

  return (
    <form action={action} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="clinicName">{t("clinicName")}</FieldLabel>
          <Input
            id="clinicName"
            name="clinicName"
            required
            minLength={2}
            autoComplete="organization"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="fullName">{t("fullName")}</FieldLabel>
          <Input
            id="fullName"
            name="fullName"
            required
            minLength={2}
            autoComplete="name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
      </FieldGroup>

      {error ? <FieldError>{error}</FieldError> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("signupSubmit")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, null);
  const error = mapAuthError(t, state);

  return (
    <form action={action} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            >
              {t("forgotPasswordLink")}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
      </FieldGroup>

      {error ? <FieldError>{error}</FieldError> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("loginSubmit")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
          {t("signupLink")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  const error =
    state?.error != null
      ? mapAuthError(t, { error: state.error })
      : null;
  const sent = state?.message === "resetEmailSent";

  return (
    <form action={action} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </Field>
      </FieldGroup>

      {sent ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("resetEmailSent")}
        </p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("forgotPasswordSubmit")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  const error = mapAuthError(t, state);

  return (
    <form action={action} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">{t("newPassword")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
      </FieldGroup>

      {error ? <FieldError>{error}</FieldError> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("resetPasswordSubmit")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/forgot-password"
          className="text-foreground underline-offset-4 hover:underline"
        >
          {t("requestNewResetLink")}
        </Link>
      </p>
    </form>
  );
}
