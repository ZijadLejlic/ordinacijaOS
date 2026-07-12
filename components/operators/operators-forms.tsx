"use client";

import { useActionState, useState, useTransition } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createOperatorAction,
  setOperatorActiveAction,
  updateOperatorPinAction,
  type OperatorActionState,
} from "@/lib/operators/actions";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type OperatorDeskMember = {
  id: string;
  fullName: string;
  role: AppRole;
};

export type OperatorRow = {
  id: string;
  profileId: string;
  displayName: string;
  isActive: boolean;
};

function mapOperatorError(
  t: ReturnType<typeof useTranslations<"Operators">>,
  state: OperatorActionState,
) {
  if (!state?.error) return null;
  const known = [
    "invalid",
    "forbidden",
    "unauthorized",
    "invalidPin",
    "invalidProfile",
    "pinTaken",
    "notFound",
    "locked",
    "failed",
  ] as const;
  if ((known as readonly string[]).includes(state.error)) {
    return t(`errors.${state.error as (typeof known)[number]}`);
  }
  return state.error;
}

export function CreateOperatorForm({
  desks,
}: {
  desks: OperatorDeskMember[];
}) {
  const t = useTranslations("Operators");
  const tUsers = useTranslations("Users");
  const [state, action, pending] = useActionState(createOperatorAction, null);
  const error = mapOperatorError(t, state);

  if (desks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("noDesks")}</p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="profileId">{t("sharedAccount")}</FieldLabel>
          <select
            id="profileId"
            name="profileId"
            required
            defaultValue={desks[0]?.id}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {desks.map((desk) => (
              <option key={desk.id} value={desk.id}>
                {desk.fullName} ({tUsers(`roles.${desk.role}`)})
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="displayName">{t("displayName")}</FieldLabel>
          <Input id="displayName" name="displayName" required maxLength={80} />
        </Field>
        <Field>
          <FieldLabel htmlFor="pin">{t("pin")}</FieldLabel>
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            minLength={4}
            maxLength={6}
            required
          />
        </Field>
      </FieldGroup>

      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "operatorCreated" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("operatorCreated")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("createSubmit")}
      </Button>
    </form>
  );
}

export function OperatorsTable({ operators }: { operators: OperatorRow[] }) {
  const t = useTranslations("Operators");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetState, resetAction, resetPending] = useActionState(
    updateOperatorPinAction,
    null,
  );

  function toggle(operatorId: string, isActive: boolean) {
    setFlash(null);
    setError(null);
    startTransition(async () => {
      const result = await setOperatorActiveAction(operatorId, isActive);
      if (result?.error) {
        setError(mapOperatorError(t, result) ?? result.error);
        return;
      }
      if (result?.message === "operatorDeactivated") {
        setFlash(t("operatorDeactivated"));
      }
      if (result?.message === "operatorReactivated") {
        setFlash(t("operatorReactivated"));
      }
    });
  }

  if (operators.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("noOperators")}</p>
    );
  }

  const resetError = mapOperatorError(t, resetState);

  return (
    <div className="space-y-4">
      {flash ? (
        <p className="text-sm text-green-700 dark:text-green-400">{flash}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      {resetState?.message === "pinUpdated" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("pinUpdated")}
        </p>
      ) : null}
      {resetError ? <FieldError>{resetError}</FieldError> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("displayName")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operators.map((op) => (
            <TableRow key={op.id}>
              <TableCell>{op.displayName}</TableCell>
              <TableCell>
                {op.isActive ? t("active") : t("inactive")}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      setResetId((current) =>
                        current === op.id ? null : op.id,
                      )
                    }
                  >
                    {t("resetPin")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => toggle(op.id, !op.isActive)}
                  >
                    {op.isActive ? t("deactivate") : t("reactivate")}
                  </Button>
                </div>
                {resetId === op.id ? (
                  <form action={resetAction} className="mt-3 flex gap-2">
                    <input type="hidden" name="operatorId" value={op.id} />
                    <Input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4,6}"
                      minLength={4}
                      maxLength={6}
                      placeholder={t("newPin")}
                      required
                      className="max-w-[140px]"
                    />
                    <Button type="submit" size="sm" disabled={resetPending}>
                      {resetPending ? t("submitting") : t("savePin")}
                    </Button>
                  </form>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
