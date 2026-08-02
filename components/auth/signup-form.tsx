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
import { signupAction } from "@/lib/auth/actions";
import { mapAuthError } from "@/components/auth/map-auth-error";

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
