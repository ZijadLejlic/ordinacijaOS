"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { upsertToothStatusAction, type OdontogramActionState } from "@/lib/odontogram/actions";
import {
  FDI_LAYOUT,
  TOOTH_STATUS_COLORS,
  TOOTH_STATUSES,
} from "@/lib/odontogram/fdi";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

type ToothStatus = Database["public"]["Enums"]["tooth_status"];

export type ToothRow = {
  fdiNumber: number;
  status: ToothStatus;
  notes: string | null;
};

export type OdontogramEventRow = {
  id: string;
  fdiNumber: number;
  eventType: string;
  statusBefore: ToothStatus | null;
  statusAfter: ToothStatus | null;
  note: string | null;
  createdAt: string;
};

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "patientNotFound",
  "saveFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Odontogram">>,
  state: OdontogramActionState,
) {
  if (!state?.error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(state.error)) {
    return t(`errors.${state.error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function ToothButton({
  fdiNumber,
  status,
  selected,
  onSelect,
}: {
  fdiNumber: number;
  status: ToothStatus;
  selected: boolean;
  onSelect: (fdi: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(fdiNumber)}
      className={cn(
        "flex size-9 flex-col items-center justify-center rounded-md border text-xs font-medium transition-colors",
        TOOTH_STATUS_COLORS[status],
        selected ? "ring-2 ring-primary ring-offset-1" : "",
      )}
      title={String(fdiNumber)}
    >
      {fdiNumber}
    </button>
  );
}

export function Odontogram({
  patientId,
  teeth,
  events,
  canWrite,
}: {
  patientId: string;
  teeth: ToothRow[];
  events: OdontogramEventRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Odontogram");
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(
    upsertToothStatusAction.bind(null, patientId),
    null,
  );
  const error = mapError(t, state);

  const statusByFdi = new Map(teeth.map((tooth) => [tooth.fdiNumber, tooth]));
  const selectedTooth = selectedFdi ? statusByFdi.get(selectedFdi) : undefined;

  function statusOf(fdi: number): ToothStatus {
    return statusByFdi.get(fdi)?.status ?? "healthy";
  }

  function selectTooth(fdi: number) {
    setSelectedFdi(fdi);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 overflow-x-auto">
        <div className="flex gap-1">
          {FDI_LAYOUT.upperRow.map((fdi) => (
            <ToothButton
              key={fdi}
              fdiNumber={fdi}
              status={statusOf(fdi)}
              selected={selectedFdi === fdi}
              onSelect={selectTooth}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {FDI_LAYOUT.lowerRow.map((fdi) => (
            <ToothButton
              key={fdi}
              fdiNumber={fdi}
              status={statusOf(fdi)}
              selected={selectedFdi === fdi}
              onSelect={selectTooth}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {TOOTH_STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className={cn("size-3 rounded-sm border", TOOTH_STATUS_COLORS[status])}
            />
            {t(`statuses.${status}`)}
          </span>
        ))}
      </div>

      {!selectedFdi ? (
        <p className="text-muted-foreground text-sm">{t("selectTooth")}</p>
      ) : (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">
            {t("tooth", { fdi: selectedFdi })}
          </p>
          {canWrite ? (
            <form
              key={selectedFdi}
              action={formAction}
              className="space-y-3"
            >
              <input type="hidden" name="fdiNumber" value={selectedFdi} />
              <Field>
                <FieldLabel htmlFor="status">{t("status")}</FieldLabel>
                <select
                  id="status"
                  name="status"
                  defaultValue={selectedTooth?.status ?? "healthy"}
                  className="border-input bg-background h-8 w-full max-w-xs rounded-lg border px-2.5 text-sm"
                >
                  {TOOTH_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`statuses.${status}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="note">{t("note")}</FieldLabel>
                <Textarea
                  id="note"
                  name="note"
                  defaultValue={selectedTooth?.notes ?? ""}
                />
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
              {state?.message === "toothUpdated" ? (
                <p className="text-sm text-green-700 dark:text-green-400">
                  {t("toothUpdated")}
                </p>
              ) : null}
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("submitting") : t("save")}
              </Button>
            </form>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                {t("status")}:{" "}
                {t(`statuses.${selectedTooth?.status ?? "healthy"}`)}
              </p>
              <p className="text-muted-foreground">
                {selectedTooth?.notes?.trim()
                  ? selectedTooth.notes
                  : t("noNote")}
              </p>
              <p className="text-muted-foreground">{t("readOnly")}</p>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">{t("history")}</p>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noHistory")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {t("tooth", { fdi: event.fdiNumber })}:{" "}
                  {event.statusBefore ? t(`statuses.${event.statusBefore}`) : "—"}
                  {" \u2192 "}
                  {event.statusAfter ? t(`statuses.${event.statusAfter}`) : "—"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
