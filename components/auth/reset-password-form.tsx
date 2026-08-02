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
import { updatePasswordAction } from "@/lib/auth/actions";
import { mapAuthError } from "@/components/auth/map-auth-error";

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
