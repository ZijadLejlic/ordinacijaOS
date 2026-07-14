"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  updateConsentFormAction,
  type ConsentActionState,
} from "@/lib/consent/actions";
import type { ConsentFormRow } from "@/lib/consent/load";
import { CONSENT_TEMPLATE_VARS } from "@/lib/consent/templates";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "saveFailed",
  "templateNotFound",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"ConsentTemplates">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function TemplateEditor({
  template,
  canEdit,
}: {
  template: ConsentFormRow;
  canEdit: boolean;
}) {
  const t = useTranslations("ConsentTemplates");
  const [saveState, saveAction, savePending] = useActionState<
    ConsentActionState,
    FormData
  >(updateConsentFormAction, null);

  const saveError = mapError(t, saveState?.error);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">
          {t(`locales.${template.locale}`)} — {t(`keys.${template.templateKey}`)}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t("varsHint", {
            vars: CONSENT_TEMPLATE_VARS.map((v) => `{{${v}}}`).join(", "),
          })}
        </p>
      </div>

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="templateKey" value={template.templateKey} />
        <input type="hidden" name="locale" value={template.locale} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`title-${template.id}`}>{t("titleField")}</FieldLabel>
            <Input
              id={`title-${template.id}`}
              name="title"
              defaultValue={template.title}
              maxLength={200}
              required
              disabled={!canEdit || savePending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`body-${template.id}`}>{t("body")}</FieldLabel>
            <Textarea
              id={`body-${template.id}`}
              name="bodyText"
              defaultValue={template.bodyText}
              rows={12}
              maxLength={20000}
              required
              disabled={!canEdit || savePending}
              className="font-mono text-sm"
            />
          </Field>
        </FieldGroup>
        {saveError ? <FieldError>{saveError}</FieldError> : null}
        {saveState?.message === "saved" ? (
          <p className="text-sm text-emerald-700" role="status">
            {t("saved")}
          </p>
        ) : null}
        {canEdit ? (
          <Button type="submit" disabled={savePending}>
            {savePending ? t("submitting") : t("save")}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">{t("readOnlyHint")}</p>
        )}
      </form>
    </div>
  );
}

export function ConsentTemplateForms({
  templates,
  canEdit,
}: {
  templates: ConsentFormRow[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-8">
      {templates.map((template) => (
        <TemplateEditor
          key={template.id}
          template={template}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
