"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BRAND_LOGO, PRODUCT_NAME } from "@/lib/brand/constants";
import { currencyLabel } from "@/lib/money/format";
import {
  advanceOnboardingServicesAction,
  createOnboardingServiceAction,
  inviteOnboardingStaffAction,
  saveOnboardingClinicAction,
  skipOnboardingInviteAction,
  type OnboardingActionState,
} from "@/lib/onboarding/actions";
import {
  WEEKDAYS,
  type OnboardingState,
  type WorkingHours,
} from "@/lib/onboarding/parse";
import { onboardingInviteRoles } from "@/lib/onboarding/rbac";
import { logoutAction } from "@/lib/auth/actions";

const TIMEZONES = [
  "Europe/Sarajevo",
  "Europe/Belgrade",
  "Europe/Zagreb",
  "Europe/Podgorica",
  "Europe/Skopje",
  "Europe/Ljubljana",
  "UTC",
] as const;

const PHONE_COUNTRIES = ["+387", "+385", "+381", "+382", "+389", "+383"] as const;

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "saveFailed",
  "createFailed",
  "needService",
  "incompleteSteps",
  "userLimit",
  "doctorLimit",
  "emailTaken",
  "inviteExists",
  "inviteFailed",
  "emailFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Onboarding">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

export type OnboardingWizardProps = {
  clinicName: string;
  timezone: string;
  phoneCountryDefault: string;
  workingHours: WorkingHours;
  onboarding: OnboardingState;
  serviceCount: number;
  practicesAsDoctor: boolean;
};

export function OnboardingWizard({
  clinicName,
  timezone,
  phoneCountryDefault,
  workingHours,
  onboarding,
  serviceCount,
  practicesAsDoctor,
}: OnboardingWizardProps) {
  const t = useTranslations("Onboarding");
  const [step, setStep] = useState<1 | 2 | 3>(
    onboarding.completed ? 3 : onboarding.step,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-4 inline-flex items-center gap-2 text-sm font-medium tracking-wide">
            {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
            <img
              src={BRAND_LOGO.mark}
              alt=""
              className="h-7 w-7 object-contain"
            />
            {PRODUCT_NAME}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            {t("logout")}
          </Button>
        </form>
      </div>

      <ol className="flex gap-2 text-sm" aria-label={t("stepsLabel")}>
        {([1, 2, 3] as const).map((n) => (
          <li
            key={n}
            className={
              n === step
                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-medium"
                : n < step
                  ? "bg-muted rounded-md px-3 py-1.5"
                  : "text-muted-foreground rounded-md px-3 py-1.5"
            }
          >
            {t(`step${n}.short`)}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <StepClinic
          clinicName={clinicName}
          timezone={timezone}
          phoneCountryDefault={phoneCountryDefault}
          workingHours={workingHours}
          practicesAsDoctor={practicesAsDoctor}
          onAdvanced={() => setStep(2)}
        />
      ) : null}
      {step === 2 ? (
        <StepServices
          serviceCount={serviceCount}
          onAdvanced={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      ) : null}
      {step === 3 ? (
        <StepInvite onBack={() => setStep(2)} />
      ) : null}
    </main>
  );
}

function StepClinic({
  clinicName,
  timezone,
  phoneCountryDefault,
  workingHours,
  practicesAsDoctor,
  onAdvanced,
}: {
  clinicName: string;
  timezone: string;
  phoneCountryDefault: string;
  workingHours: WorkingHours;
  practicesAsDoctor: boolean;
  onAdvanced: () => void;
}) {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState(
    saveOnboardingClinicAction,
    null as OnboardingActionState,
  );
  const error = mapError(t, state?.error);

  useEffect(() => {
    if (state?.message === "clinicSaved") onAdvanced();
  }, [state, onAdvanced]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("step1.title")}</CardTitle>
        <CardDescription>{t("step1.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="clinicName">{t("clinicName")}</FieldLabel>
              <Input
                id="clinicName"
                name="clinicName"
                required
                minLength={2}
                defaultValue={clinicName}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="timezone">{t("timezone")}</FieldLabel>
              <select
                id="timezone"
                name="timezone"
                required
                defaultValue={timezone}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="phoneCountryDefault">
                {t("phoneCountry")}
              </FieldLabel>
              <select
                id="phoneCountryDefault"
                name="phoneCountryDefault"
                required
                defaultValue={phoneCountryDefault}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {PHONE_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGroup>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="practicesAsDoctor"
              value="on"
              defaultChecked={practicesAsDoctor}
              className="mt-0.5 size-4 rounded border"
            />
            <span>
              <span className="font-medium">{t("practicesAsDoctor")}</span>
              <span className="text-muted-foreground mt-1 block">
                {t("practicesAsDoctorHint")}
              </span>
            </span>
          </label>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t("workingHours")}</p>
            <div className="space-y-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="grid grid-cols-[7rem_1fr] items-center gap-2 sm:grid-cols-[8rem_auto_auto_auto] sm:gap-3"
                >
                  <span className="text-sm">{t(`days.${day}`)}</span>
                  <label className="flex items-center gap-2 text-sm sm:col-span-1">
                    <input
                      type="checkbox"
                      name={`${day}_closed`}
                      defaultChecked={workingHours[day].closed}
                      className="size-4 rounded border"
                    />
                    {t("closed")}
                  </label>
                  <Input
                    type="time"
                    name={`${day}_open`}
                    defaultValue={workingHours[day].open}
                    className="h-8"
                    aria-label={t("open")}
                  />
                  <Input
                    type="time"
                    name={`${day}_close`}
                    defaultValue={workingHours[day].close}
                    className="h-8"
                    aria-label={t("close")}
                  />
                </div>
              ))}
            </div>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}
          <Button type="submit" disabled={pending}>
            {pending ? t("submitting") : t("continue")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StepServices({
  serviceCount,
  onAdvanced,
  onBack,
}: {
  serviceCount: number;
  onAdvanced: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const [localCount, setLocalCount] = useState(serviceCount);
  const [createState, createAction, createPending] = useActionState(
    createOnboardingServiceAction,
    null as OnboardingActionState,
  );
  const [advanceState, advanceAction, advancePending] = useActionState(
    advanceOnboardingServicesAction,
    null as OnboardingActionState,
  );
  const createError = mapError(t, createState?.error);
  const advanceError = mapError(t, advanceState?.error);

  const [seenCreateState, setSeenCreateState] = useState(createState);
  if (createState !== seenCreateState) {
    setSeenCreateState(createState);
    if (createState?.message === "serviceCreated") {
      setLocalCount((c) => c + 1);
    }
  }

  useEffect(() => {
    if (advanceState?.message === "servicesDone") onAdvanced();
  }, [advanceState, onAdvanced]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("step2.title")}</CardTitle>
        <CardDescription>{t("step2.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm">
          {t("serviceCount", { count: localCount })}
        </p>

        <form action={createAction} className="space-y-4">
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="name">{t("serviceName")}</FieldLabel>
              <Input id="name" name="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="code">{t("serviceCode")}</FieldLabel>
              <Input id="code" name="code" />
            </Field>
            <Field>
              <FieldLabel htmlFor="durationMinutes">
                {t("durationMinutes")}
              </FieldLabel>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={1}
                max={600}
                required
                defaultValue={30}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="priceEur">
                {t("priceEur", { currency: currencyLabel(locale) })}
              </FieldLabel>
              <Input
                id="priceEur"
                name="priceEur"
                type="number"
                min={0}
                step="0.01"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="vatRate">{t("vatRate")}</FieldLabel>
              <Input
                id="vatRate"
                name="vatRate"
                type="number"
                min={0}
                max={1}
                step="0.01"
                required
                defaultValue={0.17}
              />
            </Field>
          </FieldGroup>
          {createError ? <FieldError>{createError}</FieldError> : null}
          {createState?.message === "serviceCreated" ? (
            <p className="text-sm text-green-700">{t("serviceCreated")}</p>
          ) : null}
          <Button type="submit" variant="outline" disabled={createPending}>
            {createPending ? t("submitting") : t("addService")}
          </Button>
        </form>

        <p className="text-muted-foreground text-sm">
          {t("orImport")}{" "}
          <Link href="/settings/import" className="underline">
            {t("importLink")}
          </Link>
        </p>

        {advanceError ? <FieldError>{advanceError}</FieldError> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            {t("back")}
          </Button>
          <form action={advanceAction}>
            <Button type="submit" disabled={advancePending || localCount < 1}>
              {advancePending ? t("submitting") : t("continue")}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function StepInvite({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Onboarding");
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteOnboardingStaffAction,
    null as OnboardingActionState,
  );
  const [skipState, skipAction, skipPending] = useActionState(
    skipOnboardingInviteAction,
    null as OnboardingActionState,
  );
  const inviteError = mapError(t, inviteState?.error);
  const skipError = mapError(t, skipState?.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("step3.title")}</CardTitle>
        <CardDescription>{t("step3.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={inviteAction} className="space-y-4">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="fullName">{t("fullName")}</FieldLabel>
              <Input id="fullName" name="fullName" required minLength={2} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="role">{t("role")}</FieldLabel>
              <select
                id="role"
                name="role"
                required
                defaultValue="doctor"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {onboardingInviteRoles.map((role) => (
                  <option key={role} value={role}>
                    {t(`roles.${role}`)}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGroup>
          {inviteError ? <FieldError>{inviteError}</FieldError> : null}
          {inviteState?.inviteUrl ? (
            <p className="text-muted-foreground break-all text-xs">
              {t("devLink")}: {inviteState.inviteUrl}
            </p>
          ) : null}
          <Button type="submit" disabled={invitePending}>
            {invitePending ? t("submitting") : t("sendInvite")}
          </Button>
        </form>

        <div className="border-t pt-4">
          <p className="text-muted-foreground mb-3 text-sm">{t("skipHint")}</p>
          {skipError ? <FieldError>{skipError}</FieldError> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={onBack}>
              {t("back")}
            </Button>
            <form action={skipAction}>
              <Button type="submit" variant="outline" disabled={skipPending}>
                {skipPending ? t("submitting") : t("skipInvite")}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
