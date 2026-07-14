"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  addAllergyAction,
  createPatientAction,
  deactivatePatientAction,
  deleteAllergyAction,
  updatePatientAction,
  type PatientActionState,
} from "@/lib/patients/actions";
import { allergySeverities } from "@/lib/validations/patient";
import type { Database } from "@/lib/supabase/database.types";

type AllergySeverity = Database["public"]["Enums"]["allergy_severity"];

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "patientNotFound",
  "createFailed",
  "saveFailed",
  "documentMustBePdf",
  "documentTooLarge",
  "documentNotFound",
  "imageMustBeImage",
  "imageLimit",
  "imageConvertFailed",
  "imageNotFound",
  "uploadFailed",
  "signedUrlFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Patients">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function mapStateError(
  t: ReturnType<typeof useTranslations<"Patients">>,
  state: PatientActionState,
) {
  return mapError(t, state?.error);
}

export function PatientSearchForm({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations("Patients");
  return (
    <form className="flex gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder={t("searchPlaceholder")}
      />
      <Button type="submit" variant="outline">
        {t("search")}
      </Button>
    </form>
  );
}

export type PatientFormValues = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  nextControlAt: string;
  address: string;
  medicalHistory: string;
  notes: string;
};

export function PatientForm({
  mode,
  patient,
  disabled = false,
}: {
  mode: "create" | "edit";
  patient?: PatientFormValues;
  disabled?: boolean;
}) {
  const t = useTranslations("Patients");
  const action =
    mode === "create"
      ? createPatientAction
      : updatePatientAction.bind(null, patient!.id);
  const [state, formAction, pending] = useActionState(action, null);
  const error = mapStateError(t, state);

  return (
    <form action={formAction} className="space-y-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="firstName">{t("firstName")}</FieldLabel>
          <Input
            id="firstName"
            name="firstName"
            required
            disabled={disabled}
            defaultValue={patient?.firstName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="lastName">{t("lastName")}</FieldLabel>
          <Input
            id="lastName"
            name="lastName"
            required
            disabled={disabled}
            defaultValue={patient?.lastName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
          <Input
            id="phone"
            name="phone"
            disabled={disabled}
            defaultValue={
              mode === "create" ? patient?.phone || "+387" : patient?.phone
            }
            placeholder="+387"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            disabled={disabled}
            defaultValue={patient?.email}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dateOfBirth">{t("dateOfBirth")}</FieldLabel>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            disabled={disabled}
            defaultValue={patient?.dateOfBirth}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="nextControlAt">{t("nextControlAt")}</FieldLabel>
          <Input
            id="nextControlAt"
            name="nextControlAt"
            type="date"
            disabled={disabled}
            defaultValue={patient?.nextControlAt}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="address">{t("address")}</FieldLabel>
          <Input
            id="address"
            name="address"
            disabled={disabled}
            defaultValue={patient?.address}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="medicalHistory">{t("medicalHistory")}</FieldLabel>
          <Textarea
            id="medicalHistory"
            name="medicalHistory"
            disabled={disabled}
            defaultValue={patient?.medicalHistory}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            disabled={disabled}
            defaultValue={patient?.notes}
          />
        </Field>
      </FieldGroup>

      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "patientUpdated" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("patientUpdated")}
        </p>
      ) : null}

      {!disabled ? (
        <Button type="submit" disabled={pending}>
          {pending
            ? t("submitting")
            : mode === "create"
              ? t("create")
              : t("save")}
        </Button>
      ) : null}
    </form>
  );
}

export function DeactivatePatientButton({ patientId }: { patientId: string }) {
  const t = useTranslations("Patients");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <FieldError>{error}</FieldError> : null}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deactivatePatientAction(patientId);
            if (result?.error) {
              setError(mapError(t, result.error));
              return;
            }
            router.push("/patients");
          })
        }
      >
        {t("deactivate")}
      </Button>
    </div>
  );
}

export function AllergyForm({ patientId }: { patientId: string }) {
  const t = useTranslations("Patients");
  const [state, formAction, pending] = useActionState(
    addAllergyAction.bind(null, patientId),
    null,
  );
  const error = mapStateError(t, state);

  return (
    <form action={formAction} className="space-y-3">
      <FieldGroup className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field>
          <FieldLabel htmlFor="allergen">{t("allergen")}</FieldLabel>
          <Input id="allergen" name="allergen" required maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="severity">{t("severity")}</FieldLabel>
          <select
            id="severity"
            name="severity"
            required
            defaultValue="unknown"
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
          >
            {allergySeverities.map((severity: AllergySeverity) => (
              <option key={severity} value={severity}>
                {t(`severityLevels.${severity}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="allergyNotes">{t("allergyNotes")}</FieldLabel>
          <Input id="allergyNotes" name="notes" maxLength={2000} />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "allergyAdded" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("allergyAdded")}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("addAllergy")}
      </Button>
    </form>
  );
}

export type AllergyRow = {
  id: string;
  allergen: string;
  severity: AllergySeverity;
  notes: string | null;
};

export function AllergiesTable({
  patientId,
  allergies,
  canWrite,
}: {
  patientId: string;
  allergies: AllergyRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Patients");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (allergies.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noAllergies")}</p>;
  }

  return (
    <div className="space-y-2">
      {error ? <FieldError>{error}</FieldError> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("allergen")}</TableHead>
            <TableHead>{t("severity")}</TableHead>
            <TableHead>{t("allergyNotes")}</TableHead>
            {canWrite ? (
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allergies.map((allergy) => (
            <TableRow key={allergy.id}>
              <TableCell className="font-medium">{allergy.allergen}</TableCell>
              <TableCell>{t(`severityLevels.${allergy.severity}`)}</TableCell>
              <TableCell className="max-w-64 truncate">
                {allergy.notes ?? "—"}
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteAllergyAction(
                          allergy.id,
                          patientId,
                        );
                        if (result?.error) {
                          setError(mapError(t, result.error));
                        }
                      })
                    }
                  >
                    {t("deleteAllergy")}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
