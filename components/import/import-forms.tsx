"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  importPatientsAction,
  importServicesAction,
  type ImportActionState,
} from "@/lib/import/actions";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "featureDisabled",
  "emptyFile",
  "fileTooLarge",
  "invalidFileType",
  "missingHeaders",
  "parseFailed",
  "noRows",
  "tooManyRows",
  "hasRowErrors",
  "importFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Import">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.importFailed");
}

function PreviewSummary({ state }: { state: ImportActionState }) {
  const t = useTranslations("Import");
  if (!state || state.totalCount === undefined) return null;

  return (
    <div className="space-y-3 text-sm">
      <p>
        {t("summary", {
          total: state.totalCount,
          valid: state.validCount ?? 0,
          errors: state.errorCount ?? 0,
        })}
      </p>

      {state.rowErrors && state.rowErrors.length > 0 ? (
        <div className="space-y-1">
          <p className="font-medium">{t("rowErrorsTitle")}</p>
          <ul className="text-destructive list-inside list-disc">
            {state.rowErrors.map((err) => (
              <li key={`${err.rowNumber}-${err.message}`}>
                {t("rowError", { row: err.rowNumber, message: err.message })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.sample && state.sample.length > 0 ? (
        <div className="overflow-x-auto">
          <p className="mb-2 font-medium">{t("sampleTitle")}</p>
          <Table>
            <TableHeader>
              <TableRow>
                {Object.keys(state.sample[0]!).map((key) => (
                  <TableHead key={key}>{key}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.sample.map((row, idx) => (
                <TableRow key={idx}>
                  {Object.values(row).map((value, i) => (
                    <TableCell key={i}>
                      {value === null || value === undefined
                        ? "—"
                        : String(value)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function ImportCard({
  kind,
  action,
  templateHeaders,
  templateExample,
}: {
  kind: "patients" | "services";
  action: (
    prev: ImportActionState,
    formData: FormData,
  ) => Promise<ImportActionState>;
  templateHeaders: string;
  templateExample: string;
}) {
  const t = useTranslations("Import");
  const [state, formAction, pending] = useActionState(action, null);
  const error = mapError(t, state?.error);
  const canCommit =
    Boolean(state) &&
    (state?.validCount ?? 0) > 0 &&
    (state?.errorCount ?? 0) === 0 &&
    state?.error !== "hasRowErrors" &&
    state?.message !== "patientsImported" &&
    state?.message !== "servicesImported";

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground space-y-1 text-sm">
        <p>{t(`${kind}.columns`)}</p>
        <p className="font-mono text-xs">{templateHeaders}</p>
        <p className="font-mono text-xs">{templateExample}</p>
      </div>

      <form action={formAction} className="space-y-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${kind}-file`}>{t("fileLabel")}</FieldLabel>
            <input
              id={`${kind}-file`}
              name="file"
              type="file"
              accept=".csv,text/csv,text/plain"
              required
              className="border-input bg-background block w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:text-sm file:font-medium"
            />
          </Field>
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}

        {state?.message === "patientsImported" ||
        state?.message === "servicesImported" ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            {t(state.message, { count: state.importedCount ?? 0 })}
          </p>
        ) : null}

        <PreviewSummary state={state} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="mode"
            value="preview"
            variant="outline"
            disabled={pending}
          >
            {pending ? t("submitting") : t("preview")}
          </Button>
          {canCommit ? (
            <Button type="submit" name="mode" value="commit" disabled={pending}>
              {pending ? t("submitting") : t("commit")}
            </Button>
          ) : null}
        </div>
        {canCommit ? (
          <p className="text-muted-foreground text-xs">{t("commitHint")}</p>
        ) : null}
      </form>
    </div>
  );
}

export function PatientsImportForm() {
  const t = useTranslations("Import");
  return (
    <ImportCard
      kind="patients"
      action={importPatientsAction}
      templateHeaders={t("patients.headerLine")}
      templateExample={t("patients.exampleLine")}
    />
  );
}

export function ServicesImportForm() {
  const t = useTranslations("Import");
  return (
    <ImportCard
      kind="services"
      action={importServicesAction}
      templateHeaders={t("services.headerLine")}
      templateExample={t("services.exampleLine")}
    />
  );
}
