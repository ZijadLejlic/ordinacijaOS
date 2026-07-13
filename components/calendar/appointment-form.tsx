"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  createAppointmentAction,
  updateAppointmentAction,
  type AppointmentActionState,
} from "@/lib/appointments/actions";
import {
  appointmentStatuses,
  type CreateAppointmentInput,
} from "@/lib/validations/appointment";
import {
  CLINIC_TIMEZONE,
  formatDateTimeLocal,
  localInputToIso,
} from "@/lib/calendar/time";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "featureDisabled",
  "patientNotFound",
  "patientInactive",
  "doctorNotFound",
  "appointmentNotFound",
  "appointmentOverlap",
  "createFailed",
  "saveFailed",
] as const;

export type DoctorOption = { id: string; fullName: string };
export type PatientOption = {
  id: string;
  fullName: string;
  isActive: boolean;
};
export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
};
export type LocationOption = { id: string; name: string };

export type AppointmentDraft = {
  id?: string;
  doctorId: string;
  patientId: string;
  locationId: string | null;
  serviceId: string | null;
  startsAt: string;
  endsAt: string;
  status: (typeof appointmentStatuses)[number];
  notes: string | null;
};

function mapError(
  t: ReturnType<typeof useTranslations<"Calendar">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

export function AppointmentForm({
  mode,
  initial,
  doctors,
  patients,
  services,
  locations,
  canPickDoctor,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  initial: AppointmentDraft;
  doctors: DoctorOption[];
  patients: PatientOption[];
  services: ServiceOption[];
  locations: LocationOption[];
  canPickDoctor: boolean;
  onClose: () => void;
  onSuccess?: (message?: string) => void;
}) {
  const t = useTranslations("Calendar");
  const [doctorId, setDoctorId] = useState(initial.doctorId);
  const [patientId, setPatientId] = useState(initial.patientId);
  const [serviceId, setServiceId] = useState(initial.serviceId ?? "");
  const [locationId, setLocationId] = useState(initial.locationId ?? "");
  const [startsLocal, setStartsLocal] = useState(
    formatDateTimeLocal(initial.startsAt, CLINIC_TIMEZONE),
  );
  const [endsLocal, setEndsLocal] = useState(
    formatDateTimeLocal(initial.endsAt, CLINIC_TIMEZONE),
  );
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.notes ?? "");

  const boundAction = useMemo(() => {
    if (mode === "edit" && initial.id) {
      return updateAppointmentAction.bind(null, initial.id);
    }
    return createAppointmentAction;
  }, [mode, initial.id]);

  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(boundAction, null);

  useEffect(() => {
    if (state?.message) {
      onSuccess?.(state.message);
      onClose();
    }
  }, [state?.message, onClose, onSuccess]);

  function onServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId);
    const service = services.find((s) => s.id === nextServiceId);
    if (!service || !startsLocal) return;
    const startIso = localInputToIso(startsLocal, CLINIC_TIMEZONE);
    const end = new Date(
      new Date(startIso).getTime() + service.durationMinutes * 60_000,
    );
    setEndsLocal(formatDateTimeLocal(end.toISOString(), CLINIC_TIMEZONE));
  }

  const startsAtIso = localInputToIso(startsLocal, CLINIC_TIMEZONE);
  const endsAtIso = localInputToIso(endsLocal, CLINIC_TIMEZONE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="startsAt" value={startsAtIso} />
      <input type="hidden" name="endsAt" value={endsAtIso} />
      {!canPickDoctor ? (
        <input type="hidden" name="doctorId" value={doctorId} />
      ) : null}

      <FieldGroup>
        {canPickDoctor ? (
          <Field>
            <FieldLabel htmlFor="doctorId">{t("doctor")}</FieldLabel>
            <select
              id="doctorId"
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
        ) : null}

        <Field>
          <FieldLabel htmlFor="patientId">{t("patient")}</FieldLabel>
          <select
            id="patientId"
            name="patientId"
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
          >
            <option value="">{t("patientPlaceholder")}</option>
            {patients
              .filter((p) => p.isActive || p.id === initial.patientId)
              .map((p) => (
                <option key={p.id} value={p.id} disabled={!p.isActive}>
                  {p.fullName}
                  {!p.isActive ? ` (${t("inactive")})` : ""}
                </option>
              ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="serviceId">{t("service")}</FieldLabel>
          <select
            id="serviceId"
            name="serviceId"
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={serviceId}
            onChange={(e) => onServiceChange(e.target.value)}
          >
            <option value="">{t("serviceNone")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
              </option>
            ))}
          </select>
        </Field>

        {locations.length > 0 ? (
          <Field>
            <FieldLabel htmlFor="locationId">{t("location")}</FieldLabel>
            <select
              id="locationId"
              name="locationId"
              className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">{t("locationNone")}</option>
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
            <FieldLabel htmlFor="startsLocal">{t("startsAt")}</FieldLabel>
            <Input
              id="startsLocal"
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="endsLocal">{t("endsAt")}</FieldLabel>
            <Input
              id="endsLocal"
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="status">{t("status")}</FieldLabel>
          <select
            id="status"
            name="status"
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as CreateAppointmentInput["status"])
            }
          >
            {appointmentStatuses.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </Field>
      </FieldGroup>

      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !patientId}>
          {pending
            ? t("submitting")
            : mode === "create"
              ? t("create")
              : t("save")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
