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
  sendTestEmailAction,
  updateEmailTemplateAction,
  type EmailActionState,
} from "@/lib/email/actions";
import type { EmailTemplateRow } from "@/lib/email/load";
import { EMAIL_TEMPLATE_VARS } from "@/lib/email/templates";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "saveFailed",
  "sendFailed",
  "templateNotFound",
  "missingActorEmail",
  "patientNoEmail",
  "appointmentNotFound",
  "appointmentNotSendable",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"EmailTemplates">>,
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
  template: EmailTemplateRow;
  canEdit: boolean;
}) {
  const t = useTranslations("EmailTemplates");
  const [saveState, saveAction, savePending] = useActionState<
    EmailActionState,
    FormData
  >(updateEmailTemplateAction, null);
  const [testState, testAction, testPending] = useActionState<
    EmailActionState,
    FormData
  >(sendTestEmailAction, null);

  const saveError = mapError(t, saveState?.error);
  const testError = mapError(t, testState?.error);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">
          {t(`locales.${template.locale}`)} — {t(`keys.${template.templateKey}`)}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t("varsHint", { vars: EMAIL_TEMPLATE_VARS.map((v) => `{{${v}}}`).join(", ") })}
        </p>
      </div>

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="templateKey" value={template.templateKey} />
        <input type="hidden" name="locale" value={template.locale} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`subject-${template.id}`}>
              {t("subject")}
            </FieldLabel>
            <Input
              id={`subject-${template.id}`}
              name="subject"
              defaultValue={template.subject}
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
              rows={10}
              maxLength={10000}
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

      <form action={testAction} className="flex flex-wrap items-center gap-2 border-t pt-3">
        <input type="hidden" name="templateKey" value={template.templateKey} />
        <input type="hidden" name="locale" value={template.locale} />
        <Button type="submit" variant="outline" disabled={testPending}>
          {testPending ? t("submitting") : t("sendTest")}
        </Button>
        {testError ? <FieldError>{testError}</FieldError> : null}
        {testState?.message === "testSent" ? (
          <p className="text-sm text-emerald-700" role="status">
            {t("testSent")}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function EmailTemplateForms({
  templates,
  canEdit,
}: {
  templates: EmailTemplateRow[];
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
