"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createServiceAction,
  setServiceActiveAction,
  updateServiceAction,
  type ServiceActionState,
} from "@/lib/services/actions";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "createFailed",
  "serviceNotFound",
  "saveFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Services">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function mapStateError(
  t: ReturnType<typeof useTranslations<"Services">>,
  state: ServiceActionState,
) {
  return mapError(t, state?.error);
}

export type LocationOption = { id: string; name: string };

export type ServiceRow = {
  id: string;
  name: string;
  code: string | null;
  durationMinutes: number;
  priceEur: number;
  vatRate: number;
  locationId: string | null;
  isActive: boolean;
};

export function ServiceSearchForm({
  initialQuery,
  initialStatus,
}: {
  initialQuery: string;
  initialStatus: string;
}) {
  const t = useTranslations("Services");
  return (
    <form className="flex flex-wrap gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder={t("searchPlaceholder")}
        className="min-w-[12rem] flex-1"
      />
      <select
        name="status"
        defaultValue={initialStatus}
        className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        aria-label={t("statusFilter")}
      >
        <option value="all">{t("statusAll")}</option>
        <option value="active">{t("active")}</option>
        <option value="inactive">{t("inactive")}</option>
      </select>
      <Button type="submit" variant="outline">
        {t("search")}
      </Button>
    </form>
  );
}

function LocationField({
  locations,
  sharedPricelist,
  defaultLocationId,
}: {
  locations: LocationOption[];
  sharedPricelist: boolean;
  defaultLocationId?: string | null;
}) {
  const t = useTranslations("Services");
  if (sharedPricelist || locations.length === 0) return null;

  return (
    <Field>
      <FieldLabel htmlFor="locationId">{t("location")}</FieldLabel>
      <select
        id="locationId"
        name="locationId"
        defaultValue={defaultLocationId ?? ""}
        className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
      >
        <option value="">{t("locationAll")}</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ServiceFields({ service }: { service?: ServiceRow }) {
  const t = useTranslations("Services");
  return (
    <FieldGroup className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
        <Input id="name" name="name" required defaultValue={service?.name} />
      </Field>
      <Field>
        <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
        <Input id="code" name="code" defaultValue={service?.code ?? ""} />
      </Field>
      <Field>
        <FieldLabel htmlFor="durationMinutes">{t("durationMinutes")}</FieldLabel>
        <Input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={1}
          max={600}
          required
          defaultValue={service?.durationMinutes ?? 30}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="priceEur">{t("priceEur")}</FieldLabel>
        <Input
          id="priceEur"
          name="priceEur"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={service?.priceEur}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="vatRate">{t("vatRate")}</FieldLabel>
        <Input
          id="vatRate"
          name="vatRate"
          type="number"
          min={0}
          max={1}
          step="0.01"
          required
          defaultValue={service?.vatRate ?? 0.17}
        />
      </Field>
    </FieldGroup>
  );
}

function CreateServiceFormInner({
  locations,
  sharedPricelist,
  onCreated,
}: {
  locations: LocationOption[];
  sharedPricelist: boolean;
  onCreated: () => void;
}) {
  const t = useTranslations("Services");
  const [state, formAction, pending] = useActionState(createServiceAction, null);
  const error = mapStateError(t, state);
  const handled = useRef(false);

  useEffect(() => {
    if (state?.message === "serviceCreated" && !handled.current) {
      handled.current = true;
      onCreated();
    }
  }, [state?.message, onCreated]);

  return (
    <form action={formAction} className="space-y-4">
      <ServiceFields />
      <LocationField locations={locations} sharedPricelist={sharedPricelist} />
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("create")}
      </Button>
    </form>
  );
}

export function CreateServiceForm({
  locations,
  sharedPricelist,
}: {
  locations: LocationOption[];
  sharedPricelist: boolean;
}) {
  const t = useTranslations("Services");
  const [formKey, setFormKey] = useState(0);
  const [createdFlash, setCreatedFlash] = useState(false);

  return (
    <div className="space-y-4">
      {createdFlash ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("serviceCreated")}
        </p>
      ) : null}
      <CreateServiceFormInner
        key={formKey}
        locations={locations}
        sharedPricelist={sharedPricelist}
        onCreated={() => {
          setCreatedFlash(true);
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function EditServiceForm({
  service,
  locations,
  sharedPricelist,
  onDone,
}: {
  service: ServiceRow;
  locations: LocationOption[];
  sharedPricelist: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("Services");
  const [state, formAction, pending] = useActionState(
    updateServiceAction.bind(null, service.id),
    null,
  );
  const error = mapStateError(t, state);
  const handled = useRef(false);

  useEffect(() => {
    if (state?.message === "serviceUpdated" && !handled.current) {
      handled.current = true;
      onDone();
    }
  }, [state?.message, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <ServiceFields service={service} />
      <LocationField
        locations={locations}
        sharedPricelist={sharedPricelist}
        defaultLocationId={service.locationId}
      />
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("submitting") : t("save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function formatVatPercent(vatRate: number) {
  const percent = vatRate * 100;
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

export function ServicesTable({
  services,
  locations,
  sharedPricelist,
  canWrite,
}: {
  services: ServiceRow[];
  locations: LocationOption[];
  sharedPricelist: boolean;
  canWrite: boolean;
}) {
  const t = useTranslations("Services");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const locationName = (locationId: string | null) => {
    if (!locationId) return t("locationAll");
    return locations.find((l) => l.id === locationId)?.name ?? "—";
  };

  const showLocation = !sharedPricelist;
  const colCount = 5 + (showLocation ? 1 : 0) + (canWrite ? 1 : 0);

  if (services.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <FieldError>{error}</FieldError> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.duration")}</TableHead>
            <TableHead>{t("columns.price")}</TableHead>
            <TableHead>{t("columns.vat")}</TableHead>
            {showLocation ? (
              <TableHead>{t("columns.location")}</TableHead>
            ) : null}
            <TableHead>{t("columns.status")}</TableHead>
            {canWrite ? (
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) =>
            editingId === service.id ? (
              <TableRow key={service.id}>
                <TableCell colSpan={colCount}>
                  <EditServiceForm
                    key={service.id}
                    service={service}
                    locations={locations}
                    sharedPricelist={sharedPricelist}
                    onDone={() => setEditingId(null)}
                  />
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={service.id}>
                <TableCell className="font-medium">
                  {service.name}
                  {service.code ? (
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({service.code})
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{service.durationMinutes} min</TableCell>
                <TableCell>{service.priceEur.toFixed(2)} €</TableCell>
                <TableCell>{formatVatPercent(service.vatRate)}</TableCell>
                {showLocation ? (
                  <TableCell>{locationName(service.locationId)}</TableCell>
                ) : null}
                <TableCell>
                  {service.isActive ? t("active") : t("inactive")}
                </TableCell>
                {canWrite ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(service.id)}
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setServiceActiveAction(
                              service.id,
                              !service.isActive,
                            );
                            if (result?.error) {
                              setError(mapError(t, result.error));
                            } else {
                              setError(null);
                            }
                          })
                        }
                      >
                        {service.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
