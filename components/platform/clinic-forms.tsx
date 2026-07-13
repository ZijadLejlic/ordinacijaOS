"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  startImpersonationAction,
  updateClinicPlanAction,
  updateClinicStatusAction,
  updateSubscriptionStatusAction,
  type PlatformActionState,
} from "@/lib/platform/actions";
import type { Database } from "@/lib/supabase/database.types";

type ClinicStatus = Database["public"]["Enums"]["clinic_status"];
type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

const CLINIC_STATUSES: ClinicStatus[] = [
  "active",
  "readonly",
  "pending_delete",
];

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trial",
  "active",
  "past_due",
  "canceled",
  "readonly",
];

function mapError(
  t: ReturnType<typeof useTranslations<"Platform">>,
  state: PlatformActionState,
) {
  if (!state?.error) return null;
  const known = [
    "invalid",
    "unauthorized",
    "forbidden",
    "updateFailed",
    "planNotFound",
    "ownerNotFound",
    "missingAdminEmail",
    "alreadyImpersonating",
    "sessionSwitchFailed",
    "notImpersonating",
    "impersonationMismatch",
  ] as const;
  if ((known as readonly string[]).includes(state.error)) {
    return t(`errors.${state.error as (typeof known)[number]}`);
  }
  return state.error;
}

export function ClinicStatusForm({
  clinicId,
  status,
}: {
  clinicId: string;
  status: ClinicStatus;
}) {
  const t = useTranslations("Platform");
  const [state, action, pending] = useActionState(
    updateClinicStatusAction,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clinicId" value={clinicId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="clinic-status">{t("clinicStatus")}</FieldLabel>
          <select
            id="clinic-status"
            name="status"
            defaultValue={status}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {CLINIC_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`clinicStatuses.${value}`)}
              </option>
            ))}
          </select>
          {state?.error ? (
            <FieldError>{mapError(t, state)}</FieldError>
          ) : null}
          {state?.message === "statusUpdated" ? (
            <p className="text-muted-foreground text-sm">{t("statusUpdated")}</p>
          ) : null}
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("submitting") : t("saveStatus")}
      </Button>
    </form>
  );
}

export function ClinicPlanForm({
  clinicId,
  planId,
  plans,
}: {
  clinicId: string;
  planId: string;
  plans: { id: string; code: string; name: string }[];
}) {
  const t = useTranslations("Platform");
  const [state, action, pending] = useActionState(updateClinicPlanAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clinicId" value={clinicId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="clinic-plan">{t("plan")}</FieldLabel>
          <select
            id="clinic-plan"
            name="planId"
            defaultValue={planId}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.code})
              </option>
            ))}
          </select>
          {state?.error ? (
            <FieldError>{mapError(t, state)}</FieldError>
          ) : null}
          {state?.message === "planUpdated" ? (
            <p className="text-muted-foreground text-sm">{t("planUpdated")}</p>
          ) : null}
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("submitting") : t("savePlan")}
      </Button>
    </form>
  );
}

export function SubscriptionStatusForm({
  clinicId,
  status,
}: {
  clinicId: string;
  status: SubscriptionStatus;
}) {
  const t = useTranslations("Platform");
  const [state, action, pending] = useActionState(
    updateSubscriptionStatusAction,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clinicId" value={clinicId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="sub-status">{t("subscriptionStatus")}</FieldLabel>
          <select
            id="sub-status"
            name="status"
            defaultValue={status}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {SUBSCRIPTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`subscriptionStatuses.${value}`)}
              </option>
            ))}
          </select>
          {state?.error ? (
            <FieldError>{mapError(t, state)}</FieldError>
          ) : null}
          {state?.message === "subscriptionUpdated" ? (
            <p className="text-muted-foreground text-sm">
              {t("subscriptionUpdated")}
            </p>
          ) : null}
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("submitting") : t("saveSubscription")}
      </Button>
    </form>
  );
}

export function StartImpersonationForm({ clinicId }: { clinicId: string }) {
  const t = useTranslations("Platform");
  const [state, action, pending] = useActionState(
    startImpersonationAction,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="clinicId" value={clinicId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? t("submitting") : t("impersonate")}
      </Button>
      <p className="text-muted-foreground text-xs">{t("impersonateHint")}</p>
      {state?.error ? <FieldError>{mapError(t, state)}</FieldError> : null}
    </form>
  );
}
