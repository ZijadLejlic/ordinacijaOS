"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  addWaitlistAction,
  bookWaitlistOfferAction,
  cancelWaitlistAction,
  type AppointmentActionState,
  type WaitlistSuggestion,
} from "@/lib/appointments/actions";
import {
  CLINIC_TIMEZONE,
  formatDateTimeLocal,
  localInputToIso,
  SLOT_MINUTES,
} from "@/lib/calendar/time";
import { addMinutes } from "date-fns";
import type {
  DoctorOption,
  LocationOption,
  PatientOption,
  ServiceOption,
} from "@/components/calendar/appointment-form";
import type { WaitlistRow } from "@/components/calendar/types";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "featureDisabled",
  "patientNotFound",
  "patientInactive",
  "doctorNotFound",
  "appointmentOverlap",
  "waitlistNotFound",
  "createFailed",
  "saveFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Waitlist">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

export function WaitlistPanel({
  rows,
  doctors,
  patients,
  services,
  locations,
  canWrite,
  suggestions,
  onClearSuggestions,
  defaultDoctorId,
}: {
  rows: WaitlistRow[];
  doctors: DoctorOption[];
  patients: PatientOption[];
  services: ServiceOption[];
  locations: LocationOption[];
  canWrite: boolean;
  suggestions: WaitlistSuggestion[];
  onClearSuggestions: () => void;
  defaultDoctorId: string;
}) {
  const t = useTranslations("Waitlist");
  const [addState, addAction, addPending] = useActionState<
    AppointmentActionState,
    FormData
  >(addWaitlistAction, null);
  const [pending, startTransition] = useTransition();
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (addState?.message) {
      // form reset via remount is fine; page revalidates
    }
  }, [addState?.message]);

  const waiting = rows.filter((r) => r.status === "waiting");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {suggestions.length > 0 ? (
        <div className="border-amber-200 bg-amber-50 rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{t("suggestionsTitle")}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClearSuggestions}
            >
              {t("dismissSuggestions")}
            </Button>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {s.patientName}
                  {s.preferredFrom
                    ? ` · ${s.preferredFrom}${s.preferredTo ? `–${s.preferredTo}` : ""}`
                    : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBookingId(s.id)}
                >
                  {t("book")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bookingId ? (
        <BookFromWaitlistForm
          waitlistId={bookingId}
          suggestion={
            suggestions.find((s) => s.id === bookingId) ??
            waiting.find((r) => r.id === bookingId)
          }
          doctors={doctors}
          services={services}
          locations={locations}
          defaultDoctorId={defaultDoctorId}
          onClose={() => setBookingId(null)}
        />
      ) : null}

      {canWrite ? (
        <form action={addAction} className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">{t("addTitle")}</p>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wl-patient">{t("patient")}</FieldLabel>
              <select
                id="wl-patient"
                name="patientId"
                required
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                defaultValue=""
              >
                <option value="">{t("patientPlaceholder")}</option>
                {patients
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="wl-doctor">{t("doctor")}</FieldLabel>
              <select
                id="wl-doctor"
                name="doctorId"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                defaultValue=""
              >
                <option value="">{t("anyDoctor")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="wl-service">{t("service")}</FieldLabel>
              <select
                id="wl-service"
                name="serviceId"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                defaultValue=""
              >
                <option value="">{t("anyService")}</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {locations.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="wl-location">{t("location")}</FieldLabel>
                <select
                  id="wl-location"
                  name="locationId"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                  defaultValue=""
                >
                  <option value="">{t("anyLocation")}</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <input type="hidden" name="locationId" value="" />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wl-from">{t("preferredFrom")}</FieldLabel>
                <Input id="wl-from" name="preferredFrom" type="date" />
              </Field>
              <Field>
                <FieldLabel htmlFor="wl-to">{t("preferredTo")}</FieldLabel>
                <Input id="wl-to" name="preferredTo" type="date" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="wl-notes">{t("notes")}</FieldLabel>
              <Textarea id="wl-notes" name="notes" rows={2} />
            </Field>
          </FieldGroup>
          {addState?.error ? (
            <FieldError>{mapError(t, addState.error)}</FieldError>
          ) : null}
          <Button type="submit" disabled={addPending}>
            {addPending ? t("submitting") : t("add")}
          </Button>
        </form>
      ) : null}

      {waiting.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {waiting.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{row.patientName}</p>
                <p className="text-muted-foreground text-xs">
                  {row.preferredFrom
                    ? `${row.preferredFrom}${row.preferredTo ? ` – ${row.preferredTo}` : ""}`
                    : t("anyDate")}
                </p>
              </div>
              {canWrite ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBookingId(row.id)}
                  >
                    {t("book")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await cancelWaitlistAction(row.id);
                      })
                    }
                  >
                    {t("cancelEntry")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookFromWaitlistForm({
  waitlistId,
  suggestion,
  doctors,
  services,
  locations,
  defaultDoctorId,
  onClose,
}: {
  waitlistId: string;
  suggestion?:
    | WaitlistSuggestion
    | Pick<
        WaitlistRow,
        | "patientId"
        | "patientName"
        | "doctorId"
        | "serviceId"
        | "locationId"
      >;
  doctors: DoctorOption[];
  services: ServiceOption[];
  locations: LocationOption[];
  defaultDoctorId: string;
  onClose: () => void;
}) {
  const t = useTranslations("Waitlist");
  const nowLocal = formatDateTimeLocal(new Date().toISOString(), CLINIC_TIMEZONE);
  const [startsLocal, setStartsLocal] = useState(nowLocal);
  const [endsLocal, setEndsLocal] = useState(() => {
    const start = localInputToIso(nowLocal, CLINIC_TIMEZONE);
    return formatDateTimeLocal(
      addMinutes(new Date(start), SLOT_MINUTES).toISOString(),
      CLINIC_TIMEZONE,
    );
  });
  const [doctorId, setDoctorId] = useState(
    suggestion?.doctorId ?? defaultDoctorId,
  );
  const [serviceId, setServiceId] = useState(suggestion?.serviceId ?? "");
  const [locationId, setLocationId] = useState(suggestion?.locationId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!suggestion) return null;

  const patientId =
    "patientId" in suggestion ? suggestion.patientId : "";

  function onServiceChange(next: string) {
    setServiceId(next);
    const service = services.find((s) => s.id === next);
    if (!service) return;
    const startIso = localInputToIso(startsLocal, CLINIC_TIMEZONE);
    setEndsLocal(
      formatDateTimeLocal(
        addMinutes(new Date(startIso), service.durationMinutes).toISOString(),
        CLINIC_TIMEZONE,
      ),
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await bookWaitlistOfferAction(waitlistId, fd);
          if (result?.error) {
            setError(mapError(t, result.error));
            return;
          }
          onClose();
        });
      }}
    >
      <p className="text-sm font-medium">
        {t("bookTitle", { name: suggestion.patientName })}
      </p>
      <input type="hidden" name="patientId" value={patientId} />
      <input
        type="hidden"
        name="startsAt"
        value={localInputToIso(startsLocal, CLINIC_TIMEZONE)}
      />
      <input
        type="hidden"
        name="endsAt"
        value={localInputToIso(endsLocal, CLINIC_TIMEZONE)}
      />
      <input type="hidden" name="status" value="confirmed" />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="book-doctor">{t("doctor")}</FieldLabel>
          <select
            id="book-doctor"
            name="doctorId"
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            required
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="book-service">{t("service")}</FieldLabel>
          <select
            id="book-service"
            name="serviceId"
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={serviceId}
            onChange={(e) => onServiceChange(e.target.value)}
          >
            <option value="">{t("anyService")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        {locations.length > 0 ? (
          <Field>
            <FieldLabel htmlFor="book-location">{t("location")}</FieldLabel>
            <select
              id="book-location"
              name="locationId"
              className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">{t("anyLocation")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="locationId" value="" />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="book-start">{t("startsAt")}</FieldLabel>
            <Input
              id="book-start"
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="book-end">{t("endsAt")}</FieldLabel>
            <Input
              id="book-end"
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              required
            />
          </Field>
        </div>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("submitting") : t("confirmBook")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
