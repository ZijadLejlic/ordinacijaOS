"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  removeBrandingLogoAction,
  updateBrandingColorsAction,
  uploadBrandingLogoAction,
  type BrandingActionState,
} from "@/lib/branding/actions";
import type { BrandingColors } from "@/lib/branding/parse";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "featureDisabled",
  "saveFailed",
  "uploadFailed",
  "logoTooLarge",
  "logoInvalidType",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Branding">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function ColorField({
  id,
  name,
  label,
  initial,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  initial: string | null;
  placeholder: string;
}) {
  const [value, setValue] = useState(initial ?? "");
  const pickerValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : placeholder;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          aria-label={label}
          className="border-input h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1"
          onChange={(e) => setValue(e.target.value)}
        />
        <Input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={7}
          className="font-mono text-sm"
        />
      </div>
    </Field>
  );
}

export function BrandingLogoForm({
  logoPreviewUrl,
}: {
  logoPreviewUrl: string | null;
}) {
  const t = useTranslations("Branding");
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadBrandingLogoAction,
    null as BrandingActionState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeBrandingLogoAction,
    null as BrandingActionState,
  );

  const error = mapError(t, uploadState?.error ?? removeState?.error);
  const message =
    uploadState?.message === "logoUploaded"
      ? t("logoUploaded")
      : removeState?.message === "logoRemoved"
        ? t("logoRemoved")
        : null;

  return (
    <div className="space-y-4">
      {logoPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from private bucket
        <img
          src={logoPreviewUrl}
          alt={t("logoAlt")}
          className="border-border h-20 w-20 rounded-lg border object-contain bg-white p-1"
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t("noLogo")}</p>
      )}

      <form action={uploadAction} className="space-y-3">
        <Field>
          <FieldLabel htmlFor="logo">{t("logoFile")}</FieldLabel>
          <Input
            id="logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            required
          />
          <p className="text-muted-foreground mt-1 text-xs">{t("logoHint")}</p>
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <Button type="submit" disabled={uploadPending || removePending}>
          {uploadPending ? t("submitting") : t("uploadLogo")}
        </Button>
      </form>

      {logoPreviewUrl ? (
        <form action={removeAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={uploadPending || removePending}
          >
            {removePending ? t("submitting") : t("removeLogo")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function BrandingColorsForm({ colors }: { colors: BrandingColors }) {
  const t = useTranslations("Branding");
  const [state, action, pending] = useActionState(
    updateBrandingColorsAction,
    null as BrandingActionState,
  );
  const error = mapError(t, state?.error);

  return (
    <form action={action} className="space-y-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-3">
        <ColorField
          id="background"
          name="background"
          label={t("colorBackground")}
          initial={colors.background}
          placeholder="#f8fafc"
        />
        <ColorField
          id="text"
          name="text"
          label={t("colorText")}
          initial={colors.text}
          placeholder="#0f172a"
        />
        <ColorField
          id="accent"
          name="accent"
          label={t("colorAccent")}
          initial={colors.accent}
          placeholder="#0f172a"
        />
      </FieldGroup>
      <p className="text-muted-foreground text-xs">{t("colorsHint")}</p>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "colorsSaved" ? (
        <p className="text-sm text-green-700">{t("colorsSaved")}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("saveColors")}
      </Button>
    </form>
  );
}
