"use client";

import { use, Suspense } from "react";
import { useTranslations } from "next-intl";
import {
  AppointmentForm,
  type AppointmentDraft,
  type DoctorOption,
  type LocationOption,
  type PatientOption,
  type ServiceOption,
} from "@/components/calendar/appointment-form";
import { WaitlistPanel } from "@/components/calendar/waitlist-panel";
import type { WaitlistRow } from "@/components/calendar/types";
import type { WaitlistSuggestion } from "@/lib/appointments/actions";

export type CalendarFormOptions = {
  patients: PatientOption[];
  services: ServiceOption[];
  locations: LocationOption[];
};

function FormOptionsLoading() {
  const t = useTranslations("Calendar");
  return (
    <p className="text-muted-foreground text-sm" aria-busy="true">
      {t("loadingFormOptions")}
    </p>
  );
}

function AppointmentFormReady({
  formOptionsPromise,
  ...props
}: {
  formOptionsPromise: Promise<CalendarFormOptions>;
  mode: "create" | "edit";
  initial: AppointmentDraft;
  doctors: DoctorOption[];
  canPickDoctor: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}) {
  const options = use(formOptionsPromise);
  return (
    <AppointmentForm
      {...props}
      patients={options.patients}
      services={options.services}
      locations={options.locations}
    />
  );
}

export function DeferredAppointmentForm(
  props: Parameters<typeof AppointmentFormReady>[0],
) {
  return (
    <Suspense fallback={<FormOptionsLoading />}>
      <AppointmentFormReady {...props} />
    </Suspense>
  );
}

function WaitlistPanelReady({
  formOptionsPromise,
  ...props
}: {
  formOptionsPromise: Promise<CalendarFormOptions>;
  rows: WaitlistRow[];
  doctors: DoctorOption[];
  canWrite: boolean;
  suggestions: WaitlistSuggestion[];
  onClearSuggestions: () => void;
  defaultDoctorId: string;
}) {
  const options = use(formOptionsPromise);
  return (
    <WaitlistPanel
      {...props}
      patients={options.patients}
      services={options.services}
      locations={options.locations}
    />
  );
}

export function DeferredWaitlistPanel(
  props: Parameters<typeof WaitlistPanelReady>[0],
) {
  return (
    <Suspense fallback={<FormOptionsLoading />}>
      <WaitlistPanelReady {...props} />
    </Suspense>
  );
}
