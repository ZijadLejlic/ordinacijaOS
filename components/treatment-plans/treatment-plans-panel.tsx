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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FDI_TEETH } from "@/lib/odontogram/fdi";
import {
  addTreatmentPlanItemAction,
  createTreatmentPlanAction,
  setTreatmentPlanActiveAction,
  updateTreatmentPlanItemStatusAction,
  type TreatmentPlanActionState,
} from "@/lib/treatment-plans/actions";
import { treatmentPlanItemStatuses } from "@/lib/validations/treatment-plan";
import type { Database } from "@/lib/supabase/database.types";

type ItemStatus = Database["public"]["Enums"]["treatment_plan_item_status"];

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "featureDisabled",
  "patientNotFound",
  "patientInactive",
  "planNotFound",
  "planInactive",
  "serviceNotFound",
  "createFailed",
  "saveFailed",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"TreatmentPlan">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function mapStateError(
  t: ReturnType<typeof useTranslations<"TreatmentPlan">>,
  state: TreatmentPlanActionState,
) {
  return mapError(t, state?.error);
}

export type ServiceOption = {
  id: string;
  name: string;
  priceEur: number;
};

export type TreatmentPlanItemRow = {
  id: string;
  serviceName: string;
  fdiNumber: number | null;
  status: ItemStatus;
  estimatedPriceEur: number;
  notes: string | null;
};

export type TreatmentPlanRow = {
  id: string;
  title: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  items: TreatmentPlanItemRow[];
};

function CreatePlanFormInner({
  patientId,
  onCreated,
}: {
  patientId: string;
  onCreated: () => void;
}) {
  const t = useTranslations("TreatmentPlan");
  const [state, formAction, pending] = useActionState(
    createTreatmentPlanAction.bind(null, patientId),
    null,
  );
  const error = mapStateError(t, state);
  const handled = useRef(false);

  useEffect(() => {
    if (state?.message === "planCreated" && !handled.current) {
      handled.current = true;
      onCreated();
    }
  }, [state?.message, onCreated]);

  return (
    <form action={formAction} className="space-y-3">
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="title">{t("titleField")}</FieldLabel>
          <Input id="title" name="title" required maxLength={255} />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
          <Input id="notes" name="notes" maxLength={2000} />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("create")}
      </Button>
    </form>
  );
}

function CreatePlanForm({ patientId }: { patientId: string }) {
  const t = useTranslations("TreatmentPlan");
  const [formKey, setFormKey] = useState(0);
  const [flash, setFlash] = useState(false);

  return (
    <div className="space-y-3">
      {flash ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("planCreated")}
        </p>
      ) : null}
      <CreatePlanFormInner
        key={formKey}
        patientId={patientId}
        onCreated={() => {
          setFlash(true);
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function AddItemFormInner({
  patientId,
  planId,
  services,
  onAdded,
}: {
  patientId: string;
  planId: string;
  services: ServiceOption[];
  onAdded: () => void;
}) {
  const t = useTranslations("TreatmentPlan");
  const [state, formAction, pending] = useActionState(
    addTreatmentPlanItemAction.bind(null, patientId, planId),
    null,
  );
  const error = mapStateError(t, state);
  const handled = useRef(false);
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id ?? "",
  );
  const selected = services.find((s) => s.id === selectedServiceId);

  useEffect(() => {
    if (state?.message === "itemAdded" && !handled.current) {
      handled.current = true;
      onAdded();
    }
  }, [state?.message, onAdded]);

  if (services.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noServices")}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor={`serviceId-${planId}`}>{t("service")}</FieldLabel>
          <select
            id={`serviceId-${planId}`}
            name="serviceId"
            required
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.priceEur.toFixed(2)} €)
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`fdiNumber-${planId}`}>{t("tooth")}</FieldLabel>
          <select
            id={`fdiNumber-${planId}`}
            name="fdiNumber"
            defaultValue=""
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
          >
            <option value="">{t("toothNone")}</option>
            {FDI_TEETH.map((fdi) => (
              <option key={fdi} value={fdi}>
                {fdi}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`estimatedPriceEur-${planId}`}>
            {t("estimatedPrice")}
          </FieldLabel>
          <Input
            key={`${planId}-${selectedServiceId}`}
            id={`estimatedPriceEur-${planId}`}
            name="estimatedPriceEur"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={selected?.priceEur ?? 0}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`itemNotes-${planId}`}>{t("itemNotes")}</FieldLabel>
          <Input id={`itemNotes-${planId}`} name="notes" maxLength={1000} />
        </Field>
      </FieldGroup>
      <input type="hidden" name="status" value="planned" />
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("addItem")}
      </Button>
    </form>
  );
}

function AddItemForm({
  patientId,
  planId,
  services,
}: {
  patientId: string;
  planId: string;
  services: ServiceOption[];
}) {
  const t = useTranslations("TreatmentPlan");
  const [formKey, setFormKey] = useState(0);
  const [flash, setFlash] = useState(false);

  return (
    <div className="space-y-2">
      {flash ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("itemAdded")}
        </p>
      ) : null}
      <AddItemFormInner
        key={formKey}
        patientId={patientId}
        planId={planId}
        services={services}
        onAdded={() => {
          setFlash(true);
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function PlanCard({
  patientId,
  plan,
  services,
  canWrite,
}: {
  patientId: string;
  plan: TreatmentPlanRow;
  services: ServiceOption[];
  canWrite: boolean;
}) {
  const t = useTranslations("TreatmentPlan");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const estimateTotal = plan.items
    .filter((item) => item.status !== "cancelled")
    .reduce((sum, item) => sum + item.estimatedPriceEur, 0);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{plan.title}</h3>
          {plan.notes ? (
            <p className="text-muted-foreground text-sm">{plan.notes}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {plan.isActive ? t("active") : t("inactive")} ·{" "}
            {t("estimateTotal", { amount: estimateTotal.toFixed(2) })}
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setTreatmentPlanActiveAction(
                  patientId,
                  plan.id,
                  !plan.isActive,
                );
                if (result?.error) {
                  setError(mapError(t, result.error));
                } else {
                  setError(null);
                }
              })
            }
          >
            {plan.isActive ? t("deactivate") : t("activate")}
          </Button>
        ) : null}
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      {plan.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("emptyItems")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.service")}</TableHead>
              <TableHead>{t("columns.tooth")}</TableHead>
              <TableHead>{t("columns.price")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.serviceName}</div>
                  {item.notes ? (
                    <div className="text-muted-foreground text-xs">
                      {item.notes}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{item.fdiNumber ?? "—"}</TableCell>
                <TableCell>{item.estimatedPriceEur.toFixed(2)} €</TableCell>
                <TableCell>
                  {canWrite && plan.isActive ? (
                    <select
                      value={item.status}
                      disabled={pending}
                      className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                      aria-label={t("columns.status")}
                      onChange={(e) =>
                        startTransition(async () => {
                          const result =
                            await updateTreatmentPlanItemStatusAction(
                              patientId,
                              item.id,
                              e.target.value,
                            );
                          if (result?.error) {
                            setError(mapError(t, result.error));
                          } else {
                            setError(null);
                          }
                        })
                      }
                    >
                      {treatmentPlanItemStatuses.map((status) => (
                        <option key={status} value={status}>
                          {t(`statuses.${status}`)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    t(`statuses.${item.status}`)
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canWrite && plan.isActive ? (
        <AddItemForm
          patientId={patientId}
          planId={plan.id}
          services={services}
        />
      ) : null}
    </div>
  );
}

export function TreatmentPlansPanel({
  patientId,
  plans,
  services,
  canWrite,
}: {
  patientId: string;
  plans: TreatmentPlanRow[];
  services: ServiceOption[];
  canWrite: boolean;
}) {
  const t = useTranslations("TreatmentPlan");

  return (
    <div className="space-y-4">
      {!canWrite ? (
        <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
      ) : null}

      {canWrite ? <CreatePlanForm patientId={patientId} /> : null}

      {plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              patientId={patientId}
              plan={plan}
              services={services}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
