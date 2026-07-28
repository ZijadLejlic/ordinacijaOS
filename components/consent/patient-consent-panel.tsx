"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { SignaturePad } from "@/components/consent/signature-pad";
import {
  deleteConsentSignatureAction,
  signConsentAction,
  type ConsentActionState,
} from "@/lib/consent/actions";
import type { ConsentFormRow, ConsentSignatureRow } from "@/lib/consent/load";
import {
  renderConsentTemplate,
  type ConsentTemplateVars,
} from "@/lib/consent/templates";
import { createSignedFileUrlAction } from "@/lib/patients/actions";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "signatureEmpty",
  "patientNotFound",
  "templateNotFound",
  "pdfFailed",
  "signFailed",
  "deleteFailed",
  "notFound",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Consent">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.signFailed");
}

function SignForm({
  patientId,
  forms,
  vars,
}: {
  patientId: string;
  forms: ConsentFormRow[];
  vars: ConsentTemplateVars;
}) {
  const t = useTranslations("Consent");
  const locale = useLocale();
  const localeForms = useMemo(
    () => forms.filter((f) => f.locale === (locale === "en" ? "en" : "bs")),
    [forms, locale],
  );
  const [selectedId, setSelectedId] = useState(localeForms[0]?.id ?? "");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const selected =
    localeForms.find((f) => f.id === selectedId) ?? localeForms[0] ?? null;

  const [state, formAction, pending] = useActionState<
    ConsentActionState,
    FormData
  >(signConsentAction, null);

  const error = mapError(t, state?.error);

  if (localeForms.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("noTemplates")}</p>
    );
  }

  const previewTitle = selected
    ? renderConsentTemplate(selected.title, vars)
    : "";
  const previewBody = selected
    ? renderConsentTemplate(selected.bodyText, vars)
    : "";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="patientId" value={patientId} />
      <input
        type="hidden"
        name="consentFormId"
        value={selected?.id ?? selectedId}
      />
      <input
        type="hidden"
        name="signatureDataUrl"
        value={signatureDataUrl ?? ""}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="consent-template">
          {t("chooseTemplate")}
        </label>
        <select
          id="consent-template"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={selected?.id ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={pending}
        >
          {localeForms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="bg-muted/40 space-y-2 rounded-md border p-3 text-sm whitespace-pre-wrap">
          <p className="font-medium">{previewTitle}</p>
          <p className="text-muted-foreground">{previewBody}</p>
        </div>
      ) : null}

      <SignaturePad onChange={setSignatureDataUrl} disabled={pending} />

      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "signed" ? (
        <p className="text-sm text-emerald-700" role="status">
          {t("signed")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !signatureDataUrl || !selected}>
        {pending ? t("submitting") : t("signAndSave")}
      </Button>
    </form>
  );
}

function SignaturesList({
  patientId,
  signatures,
  canWrite,
}: {
  patientId: string;
  signatures: ConsentSignatureRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Consent");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (signatures.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("emptySignatures")}</p>
    );
  }

  return (
    <ul className="divide-border divide-y rounded-md border">
      {signatures.map((sig) => (
        <li
          key={sig.id}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium">{sig.title}</p>
            <p className="text-muted-foreground text-xs">
              {new Date(sig.signedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setError(null);
                // Safari blocks async window.open after await — open blank first.
                const popup = window.open("about:blank", "_blank");
                startTransition(async () => {
                  const res = await createSignedFileUrlAction(
                    sig.pdfStoragePath,
                  );
                  if (!res.url) {
                    popup?.close();
                    setError(res.error ?? "signedUrlFailed");
                    return;
                  }
                  if (popup) {
                    popup.location.href = res.url;
                  } else {
                    window.location.assign(res.url);
                  }
                });
              }}
            >
              {t("openPdf")}
            </Button>
            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending && pendingId === sig.id}
                onClick={() => {
                  startTransition(async () => {
                    setPendingId(sig.id);
                    setError(null);
                    const res = await deleteConsentSignatureAction(
                      patientId,
                      sig.id,
                    );
                    if (res?.error) {
                      setError(res.error);
                    }
                    setPendingId(null);
                  });
                }}
              >
                {t("delete")}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
      {error ? <li className="px-3 py-2"><FieldError>{mapError(t, error)}</FieldError></li> : null}
    </ul>
  );
}

export function PatientConsentPanel({
  patientId,
  forms,
  signatures,
  vars,
  canWrite,
  featureOk,
}: {
  patientId: string;
  forms: ConsentFormRow[];
  signatures: ConsentSignatureRow[];
  vars: ConsentTemplateVars;
  canWrite: boolean;
  featureOk: boolean;
}) {
  const t = useTranslations("Consent");

  if (!featureOk) {
    return (
      <div className="space-y-1">
        <p className="font-medium">{t("upsellTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("upsellDescription")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SignaturesList
        patientId={patientId}
        signatures={signatures}
        canWrite={canWrite}
      />
      {canWrite ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("newSignatureTitle")}</h3>
          <SignForm patientId={patientId} forms={forms} vars={vars} />
        </div>
      ) : null}
    </div>
  );
}
