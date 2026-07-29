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
  loginAction,
  signupAction,
  type AuthActionState,
} from "@/lib/auth/actions";

function mapAuthError(
  t: ReturnType<typeof useTranslations<"Auth">>,
  state: AuthActionState,
) {
  if (!state) return null;
  if (state.message === "confirmEmail") return t("confirmEmail");
  if (state.error === "invalid") return t("invalid");
  if (state.error === "invalidCredentials") return t("invalidCredentials");
  if (state.error === "locked") return t("locked");
  if (state.error === "missingClinic") return t("missingClinic");
  if (state.error === "emailTaken") return t("emailTaken");
  if (state.error === "missingAppUrl") return t("missingAppUrl");
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
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
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
