"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitLeadAction,
  type LeadActionState,
} from "@/lib/leads/actions";
import { leadPreferredTimes } from "@/lib/validations/lead";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-[10px] border-[color-mix(in_oklab,var(--marketing-ink)_18%,transparent)] bg-[var(--marketing-surface)] text-[var(--marketing-ink)] placeholder:text-[color-mix(in_oklab,var(--marketing-ink)_40%,transparent)] focus-visible:border-[var(--marketing-accent)] focus-visible:ring-[var(--marketing-accent)]/25";

export function ContactLeadForm() {
  const t = useTranslations("Marketing.contact.form");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<
    LeadActionState,
    FormData
  >(submitLeadAction, null);

  if (state?.ok) {
    return (
      <div
        className="rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] p-6 md:p-8"
        role="status"
      >
        <p className="text-lg font-medium text-[var(--marketing-ink)]">
          {t("success")}
        </p>
        <Link
          href="/tour"
          className="mt-4 inline-flex items-center text-sm font-medium text-[var(--marketing-accent)] hover:text-[var(--marketing-deep)]"
        >
          {t("successTour")}
          <span aria-hidden className="ml-1">
            →
          </span>
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="relative rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] p-6 md:p-8"
      noValidate
    >
      <h2 className="font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
        {t("body")}
      </p>

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sourcePage" value="contact" />

      {/* Honeypot — hidden from users, bots often fill it. */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="lead-website">{t("honeypot")}</label>
        <input
          id="lead-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <FieldGroup className="mt-6 gap-4">
        <Field>
          <FieldLabel htmlFor="lead-name">{t("name")}</FieldLabel>
          <Input
            id="lead-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            className={inputClass}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-clinic">{t("clinicName")}</FieldLabel>
          <Input
            id="lead-clinic"
            name="clinicName"
            required
            maxLength={120}
            autoComplete="organization"
            className={inputClass}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-phone">{t("phone")}</FieldLabel>
          <Input
            id="lead-phone"
            name="phone"
            type="tel"
            required
            minLength={6}
            maxLength={40}
            autoComplete="tel"
            placeholder={t("phoneHint")}
            defaultValue="+387 "
            className={inputClass}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-email">{t("email")}</FieldLabel>
          <Input
            id="lead-email"
            name="email"
            type="email"
            maxLength={200}
            autoComplete="email"
            className={inputClass}
          />
          <FieldDescription className="text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
            {t("emailHint")}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-time">{t("preferredTime")}</FieldLabel>
          <select
            id="lead-time"
            name="preferredTime"
            required
            defaultValue="anytime"
            className={cn(
              "border-input h-10 w-full rounded-[10px] border px-2.5 text-sm outline-none focus-visible:border-[var(--marketing-accent)] focus-visible:ring-3 focus-visible:ring-[var(--marketing-accent)]/25",
              inputClass,
            )}
          >
            {leadPreferredTimes.map((key) => (
              <option key={key} value={key}>
                {t(`preferredTimeOptions.${key}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-message">{t("message")}</FieldLabel>
          <Textarea
            id="lead-message"
            name="message"
            maxLength={1000}
            rows={4}
            className={cn("min-h-24", inputClass)}
          />
          <FieldDescription className="text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
            {t("messageHint")}
          </FieldDescription>
        </Field>

        <Field orientation="horizontal" className="items-start gap-3">
          <input
            id="lead-gdpr"
            name="gdpr"
            type="checkbox"
            required
            value="on"
            className="mt-1 size-4 shrink-0 rounded border-[color-mix(in_oklab,var(--marketing-ink)_30%,transparent)] accent-[var(--marketing-accent)]"
          />
          <FieldLabel
            htmlFor="lead-gdpr"
            className="text-sm font-normal leading-snug text-[color-mix(in_oklab,var(--marketing-ink)_80%,transparent)]"
          >
            {t("gdpr")}
          </FieldLabel>
        </Field>

        {state?.error ? (
          <FieldError>{t(`errors.${state.error}`)}</FieldError>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-[10px] bg-[var(--marketing-accent)] px-5 text-white hover:bg-[var(--marketing-deep)]"
        >
          {pending ? t("submitting") : t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
