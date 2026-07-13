"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  createSignedFileUrlAction,
  deleteDocumentAction,
  deleteImageAction,
  uploadDocumentAction,
  uploadImageAction,
  type PatientActionState,
} from "@/lib/patients/actions";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
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

export type FileRow = {
  id: string;
  title: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
};

function useSignedView() {
  const t = useTranslations("Patients");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function view(path: string) {
    setError(null);
    startTransition(async () => {
      const result = await createSignedFileUrlAction(path);
      if (result.error || !result.url) {
        setError(mapError(t, result.error ?? "signedUrlFailed"));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return { view, pending, error };
}

export function DocumentUploadForm({ patientId }: { patientId: string }) {
  const t = useTranslations("Patients");
  const [state, formAction, pending] = useActionState(
    uploadDocumentAction.bind(null, patientId),
    null,
  );
  const error = mapStateError(t, state);

  return (
    <form action={formAction} className="space-y-3">
      <FieldGroup className="grid gap-3 sm:grid-cols-[2fr_2fr]">
        <Field>
          <FieldLabel htmlFor="documentTitle">{t("documentTitle")}</FieldLabel>
          <Input id="documentTitle" name="title" required maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="documentFile">{t("documentFile")}</FieldLabel>
          <Input
            id="documentFile"
            name="file"
            type="file"
            accept="application/pdf"
            required
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "documentUploaded" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("documentUploaded")}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("uploadDocument")}
      </Button>
    </form>
  );
}

export function DocumentsList({
  patientId,
  documents,
  canWrite,
}: {
  patientId: string;
  documents: FileRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Patients");
  const { view, pending: viewPending, error: viewError } = useSignedView();
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noDocuments")}</p>;
  }

  return (
    <div className="space-y-2">
      {viewError ? <FieldError>{viewError}</FieldError> : null}
      {deleteError ? <FieldError>{deleteError}</FieldError> : null}
      <ul className="divide-y rounded-lg border">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <span className="truncate text-sm font-medium">{doc.title}</span>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={viewPending}
                onClick={() => view(doc.storagePath)}
              >
                {t("openDocument")}
              </Button>
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deletePending}
                  onClick={() =>
                    startDelete(async () => {
                      const result = await deleteDocumentAction(
                        doc.id,
                        patientId,
                      );
                      if (result?.error) {
                        setDeleteError(mapError(t, result.error));
                      }
                    })
                  }
                >
                  {t("deleteDocument")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImageUploadForm({ patientId }: { patientId: string }) {
  const t = useTranslations("Patients");
  const [state, formAction, pending] = useActionState(
    uploadImageAction.bind(null, patientId),
    null,
  );
  const error = mapStateError(t, state);

  return (
    <form action={formAction} className="space-y-3">
      <FieldGroup className="grid gap-3 sm:grid-cols-[2fr_2fr]">
        <Field>
          <FieldLabel htmlFor="imageTitle">{t("imageTitle")}</FieldLabel>
          <Input id="imageTitle" name="title" required maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="imageFile">{t("imageFile")}</FieldLabel>
          <Input
            id="imageFile"
            name="file"
            type="file"
            accept="image/*"
            required
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "imageUploaded" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("imageUploaded")}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("uploadImage")}
      </Button>
    </form>
  );
}

export function ImagesList({
  patientId,
  images,
  canWrite,
}: {
  patientId: string;
  images: FileRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Patients");
  const { view, pending: viewPending, error: viewError } = useSignedView();
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (images.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noImages")}</p>;
  }

  return (
    <div className="space-y-2">
      {viewError ? <FieldError>{viewError}</FieldError> : null}
      {deleteError ? <FieldError>{deleteError}</FieldError> : null}
      <ul className="divide-y rounded-lg border">
        {images.map((image) => (
          <li
            key={image.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <span className="truncate text-sm font-medium">{image.title}</span>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={viewPending}
                onClick={() => view(image.storagePath)}
              >
                {t("openImage")}
              </Button>
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deletePending}
                  onClick={() =>
                    startDelete(async () => {
                      const result = await deleteImageAction(
                        image.id,
                        patientId,
                      );
                      if (result?.error) {
                        setDeleteError(mapError(t, result.error));
                      }
                    })
                  }
                >
                  {t("deleteImage")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
