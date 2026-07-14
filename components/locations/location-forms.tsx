"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createLocationAction,
  setLocationActiveAction,
  updateLocationAction,
  updateSharedPricelistAction,
  type LocationActionState,
} from "@/lib/locations/actions";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "locationLimit",
  "createFailed",
  "saveFailed",
  "locationNotFound",
  "lastLocation",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Locations">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

export type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
};

export function SharedPricelistForm({
  sharedPricelist,
}: {
  sharedPricelist: boolean;
}) {
  const t = useTranslations("Locations");
  const [state, action, pending] = useActionState(
    updateSharedPricelistAction,
    null as LocationActionState,
  );
  const error = mapError(t, state?.error);

  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="sharedPricelistAcrossLocations"
          defaultChecked={sharedPricelist}
          className="mt-1 size-4 rounded border"
        />
        <span>
          <span className="font-medium">{t("sharedTitle")}</span>
          <span className="text-muted-foreground mt-0.5 block">
            {t("sharedDescription")}
          </span>
        </span>
      </label>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "settingsSaved" ? (
        <p className="text-sm text-green-700">{t("settingsSaved")}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("saveSettings")}
      </Button>
    </form>
  );
}

export function CreateLocationForm({
  canCreate,
  limitLabel,
}: {
  canCreate: boolean;
  limitLabel: string;
}) {
  const t = useTranslations("Locations");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    createLocationAction,
    null as LocationActionState,
  );

  useEffect(() => {
    if (state?.message === "created") {
      formRef.current?.reset();
    }
  }, [state?.message]);

  const error = mapError(t, state?.error);

  if (!canCreate) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("limitReached", { limit: limitLabel })}
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
          <Input id="name" name="name" required maxLength={120} />
        </Field>
        <Field>
          <FieldLabel htmlFor="address">{t("address")}</FieldLabel>
          <Input id="address" name="address" maxLength={500} />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "created" ? (
        <p className="text-sm text-green-700">{t("created")}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("create")}
      </Button>
    </form>
  );
}

function EditLocationForm({ row }: { row: LocationRow }) {
  const t = useTranslations("Locations");
  const [state, action, pending] = useActionState(
    updateLocationAction,
    null as LocationActionState,
  );
  const error = mapError(t, state?.error);

  return (
    <form action={action} className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="locationId" value={row.id} />
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`name-${row.id}`}>{t("name")}</FieldLabel>
          <Input
            id={`name-${row.id}`}
            name="name"
            required
            maxLength={120}
            defaultValue={row.name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`address-${row.id}`}>{t("address")}</FieldLabel>
          <Input
            id={`address-${row.id}`}
            name="address"
            maxLength={500}
            defaultValue={row.address ?? ""}
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "updated" ? (
        <p className="text-sm text-green-700">{t("updated")}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("save")}
      </Button>
    </form>
  );
}

export function LocationsTable({
  locations,
  activeCount,
}: {
  locations: LocationRow[];
  activeCount: number;
}) {
  const t = useTranslations("Locations");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeState, activeAction, activePending] = useActionState(
    setLocationActiveAction,
    null as LocationActionState,
  );
  const activeError = mapError(t, activeState?.error);

  if (locations.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {activeError ? <FieldError>{activeError}</FieldError> : null}
      {activeState?.message === "activated" ||
      activeState?.message === "deactivated" ? (
        <p className="text-sm text-green-700">
          {t(activeState.message === "activated" ? "activated" : "deactivated")}
        </p>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.address")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="align-top font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground align-top">
                {row.address || "—"}
              </TableCell>
              <TableCell className="align-top">
                {row.isActive ? t("active") : t("inactive")}
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingId((id) => (id === row.id ? null : row.id))
                      }
                    >
                      {editingId === row.id ? t("cancel") : t("edit")}
                    </Button>
                    <form action={activeAction}>
                      <input type="hidden" name="locationId" value={row.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={row.isActive ? "false" : "true"}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={
                          activePending ||
                          (row.isActive && activeCount <= 1)
                        }
                      >
                        {row.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    </form>
                  </div>
                  {editingId === row.id ? <EditLocationForm row={row} /> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
