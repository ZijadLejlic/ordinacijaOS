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
import {
  acceptInviteAction,
  type InviteActionState,
} from "@/lib/invites/actions";

function mapError(
  t: ReturnType<typeof useTranslations<"Invite">>,
  state: InviteActionState,
) {
  if (!state?.error) return null;
  const known = ["invalid", "inviteInvalid", "acceptFailed"] as const;
  if ((known as readonly string[]).includes(state.error)) {
    return t(`errors.${state.error as (typeof known)[number]}`);
  }
  return state.error;
}

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const t = useTranslations("Invite");
  const [state, action, pending] = useActionState(acceptInviteAction, null);
  const error = mapError(t, state);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" value={email} disabled readOnly />
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
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
