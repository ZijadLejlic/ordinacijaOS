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
import { forgotPasswordAction } from "@/lib/auth/actions";
import { mapAuthError } from "@/components/auth/map-auth-error";

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
