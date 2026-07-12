"use client";

import { useActionState, useState } from "react";
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
  switchOperatorAction,
  type OperatorActionState,
} from "@/lib/operators/actions";
import { logoutAction } from "@/lib/auth/actions";

export type PinOperatorOption = {
  id: string;
  displayName: string;
};

function mapPinError(
  t: ReturnType<typeof useTranslations<"Pin">>,
  state: OperatorActionState,
) {
  if (!state?.error) return null;
  const known = [
    "invalid",
    "invalidPin",
    "locked",
    "forbidden",
    "unauthorized",
    "notFound",
  ] as const;
  if ((known as readonly string[]).includes(state.error)) {
    return t(`errors.${state.error as (typeof known)[number]}`);
  }
  return state.error;
}

export function PinSwitchForm({ operators }: { operators: PinOperatorOption[] }) {
  const t = useTranslations("Pin");
  const [selectedId, setSelectedId] = useState(operators[0]?.id ?? "");
  const [state, action, pending] = useActionState(switchOperatorAction, null);
  const error = mapPinError(t, state);

  if (operators.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t("noOperators")}</p>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            {t("logout")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="operatorId" value={selectedId} />
        <FieldGroup>
          <Field>
            <FieldLabel>{t("operator")}</FieldLabel>
            <div className="grid gap-2">
              {operators.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setSelectedId(op.id)}
                  className={
                    selectedId === op.id
                      ? "border-foreground bg-muted rounded-md border px-3 py-2 text-left text-sm"
                      : "border-input hover:bg-muted/50 rounded-md border px-3 py-2 text-left text-sm"
                  }
                >
                  {op.displayName}
                </button>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="pin">{t("pin")}</FieldLabel>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{4,6}"
              minLength={4}
              maxLength={6}
              required
            />
          </Field>
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button type="submit" className="w-full" disabled={pending || !selectedId}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
