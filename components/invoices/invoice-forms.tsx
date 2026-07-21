"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  cancelPaymentPlanAction,
  createInvoiceAction,
  createPaymentPlanAction,
  recordPaymentAction,
  updateInvoiceLegalSettingsAction,
  voidInvoiceAction,
  type InvoiceActionState,
} from "@/lib/invoices/actions";
import { formatInvoiceNumber, roundMoney } from "@/lib/invoices/money";
import { Link } from "@/i18n/navigation";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "createFailed",
  "saveFailed",
  "patientNotFound",
  "patientInactive",
  "linesRequired",
  "invoiceNotFound",
  "alreadyVoid",
  "invoiceVoid",
  "overpayment",
  "planNotAllowed",
  "planExists",
  "planNotFound",
  "planNotActive",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Invoices">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

export type PatientOption = { id: string; name: string };
export type ServiceOption = {
  id: string;
  name: string;
  priceEur: number;
  vatRate: number;
};
export type DoctorOption = { id: string; name: string };
export type LocationOption = { id: string; name: string };

type DraftLine = {
  key: string;
  serviceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
};

export function InvoiceSearchForm({
  initialQuery,
  initialStatus,
}: {
  initialQuery: string;
  initialStatus: string;
}) {
  const t = useTranslations("Invoices");
  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Input
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder={t("searchPlaceholder")}
        className="min-w-0 w-full flex-1 sm:min-w-[12rem]"
      />
      <select
        name="status"
        defaultValue={initialStatus}
        className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm sm:w-auto"
        aria-label={t("statusFilter")}
      >
        <option value="all">{t("statusAll")}</option>
        <option value="unpaid">{t("status.unpaid")}</option>
        <option value="partial">{t("status.partial")}</option>
        <option value="paid">{t("status.paid")}</option>
        <option value="void">{t("status.void")}</option>
        <option value="debts">{t("statusDebts")}</option>
      </select>
      <Button type="submit" variant="outline" className="w-full sm:w-auto">
        {t("search")}
      </Button>
    </form>
  );
}

export function InvoicesTable({
  rows,
}: {
  rows: {
    id: string;
    number: string;
    patientName: string;
    status: string;
    total: number;
    issuedAt: string;
    balance: number;
  }[];
}) {
  const t = useTranslations("Invoices");
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colNumber")}</TableHead>
          <TableHead>{t("colPatient")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
          <TableHead className="text-right">{t("colTotal")}</TableHead>
          <TableHead className="text-right">{t("colBalance")}</TableHead>
          <TableHead>{t("colDate")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link
                href={{
                  pathname: "/invoices/[invoiceId]",
                  params: { invoiceId: row.id },
                }}
                className="underline-offset-4 hover:underline"
              >
                {row.number}
              </Link>
            </TableCell>
            <TableCell>{row.patientName}</TableCell>
            <TableCell>
              {t(`status.${row.status}` as "status.unpaid")}
            </TableCell>
            <TableCell className="text-right">
              {row.total.toFixed(2)} EUR
            </TableCell>
            <TableCell className="text-right">
              {row.balance.toFixed(2)} EUR
            </TableCell>
            <TableCell>
              {new Date(row.issuedAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CreateInvoiceForm({
  patients,
  services,
  doctors,
  locations,
}: {
  patients: PatientOption[];
  services: ServiceOption[];
  doctors: DoctorOption[];
  locations: LocationOption[];
}) {
  const t = useTranslations("Invoices");
  const [state, action, pending] = useActionState(
    createInvoiceAction,
    null as InvoiceActionState,
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: "1",
      serviceId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      vatRate: "0",
    },
  ]);

  const linesJson = useMemo(
    () =>
      JSON.stringify(
        lines.map((line) => ({
          serviceId: line.serviceId || null,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          vatRate: Number(line.vatRate),
        })),
      ),
    [lines],
  );

  function applyService(key: string, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    setLines((prev) =>
      prev.map((line) =>
        line.key !== key
          ? line
          : {
              ...line,
              serviceId,
              description: service?.name ?? line.description,
              unitPrice: service ? String(service.priceEur) : line.unitPrice,
              vatRate: service ? String(service.vatRate) : line.vatRate,
            },
      ),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="linesJson" value={linesJson} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="patientId">{t("patient")}</FieldLabel>
          <select
            id="patientId"
            name="patientId"
            required
            data-testid="invoice-patient"
            className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm"
          >
            <option value="">{t("selectPatient")}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {doctors.length > 0 ? (
          <Field>
            <FieldLabel htmlFor="doctorId">{t("doctor")}</FieldLabel>
            <select
              id="doctorId"
              name="doctorId"
              className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="">{t("optional")}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {locations.length > 1 ? (
          <Field>
            <FieldLabel htmlFor="locationId">{t("location")}</FieldLabel>
            <select
              id="locationId"
              name="locationId"
              className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="">{t("optional")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
          <Textarea id="notes" name="notes" rows={2} />
        </Field>
      </FieldGroup>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("lines")}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  key: String(Date.now()),
                  serviceId: "",
                  description: "",
                  quantity: "1",
                  unitPrice: "0",
                  vatRate: "0",
                },
              ])
            }
          >
            {t("addLine")}
          </Button>
        </div>
        {lines.map((line) => (
          <div
            key={line.key}
            className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <select
              value={line.serviceId}
              onChange={(e) => applyService(line.key, e.target.value)}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm lg:col-span-2"
              aria-label={t("service")}
              data-testid="invoice-line-service"
            >
              <option value="">{t("customLine")}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Input
              value={line.description}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l) =>
                    l.key === line.key
                      ? { ...l, description: e.target.value }
                      : l,
                  ),
                )
              }
              placeholder={t("description")}
              className="lg:col-span-2"
              required
            />
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={line.quantity}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l) =>
                    l.key === line.key
                      ? { ...l, quantity: e.target.value }
                      : l,
                  ),
                )
              }
              aria-label={t("quantity")}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l) =>
                    l.key === line.key
                      ? { ...l, unitPrice: e.target.value }
                      : l,
                  ),
                )
              }
              aria-label={t("unitPrice")}
            />
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={line.vatRate}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l) =>
                    l.key === line.key
                      ? { ...l, vatRate: e.target.value }
                      : l,
                  ),
                )
              }
              aria-label={t("vatRate")}
            />
            {lines.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLines((prev) => prev.filter((l) => l.key !== line.key))
                }
              >
                {t("removeLine")}
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}
      {state?.message === "created" && state.invoiceId ? (
        <p className="text-sm text-green-700">
          {t("created")}{" "}
          <Link
            href={{
              pathname: "/invoices/[invoiceId]",
              params: { invoiceId: state.invoiceId },
            }}
            className="underline-offset-4 hover:underline"
          >
            {t("openInvoice")}
          </Link>
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}

export function RecordPaymentForm({
  invoiceId,
  maxAmount,
}: {
  invoiceId: string;
  maxAmount: number;
}) {
  const t = useTranslations("Invoices");
  const [state, action, pending] = useActionState(
    recordPaymentAction,
    null as InvoiceActionState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="amount">{t("paymentAmount")}</FieldLabel>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            max={maxAmount}
            step="0.01"
            defaultValue={roundMoney(maxAmount)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="method">{t("paymentMethod")}</FieldLabel>
          <select
            id="method"
            name="method"
            className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm"
            defaultValue="cash"
          >
            <option value="cash">{t("methods.cash")}</option>
            <option value="card">{t("methods.card")}</option>
            <option value="bank_transfer">{t("methods.bank_transfer")}</option>
            <option value="other">{t("methods.other")}</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="note">{t("paymentNote")}</FieldLabel>
          <Input id="note" name="note" />
        </Field>
      </FieldGroup>
      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}
      {state?.message === "paymentRecorded" ? (
        <p className="text-sm text-green-700">{t("paymentRecorded")}</p>
      ) : null}
      <Button type="submit" disabled={pending || maxAmount <= 0}>
        {pending ? t("saving") : t("recordPayment")}
      </Button>
    </form>
  );
}

export function VoidInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("Invoices");
  const [state, action, pending] = useActionState(
    voidInvoiceAction,
    null as InvoiceActionState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Field>
        <FieldLabel htmlFor="reason">{t("voidReason")}</FieldLabel>
        <Input id="reason" name="reason" required />
      </Field>
      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? t("saving") : t("void")}
      </Button>
    </form>
  );
}

export function PaymentPlanForm({
  invoiceId,
  enabled,
}: {
  invoiceId: string;
  enabled: boolean;
}) {
  const t = useTranslations("Invoices");
  const [state, action, pending] = useActionState(
    createPaymentPlanAction,
    null as InvoiceActionState,
  );

  if (!enabled) {
    return (
      <p className="text-muted-foreground text-sm">{t("planFeatureRequired")}</p>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="installmentCount">
            {t("installmentCount")}
          </FieldLabel>
          <Input
            id="installmentCount"
            name="installmentCount"
            type="number"
            min={2}
            max={48}
            defaultValue={3}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="firstDueDate">{t("firstDueDate")}</FieldLabel>
          <Input
            id="firstDueDate"
            name="firstDueDate"
            type="date"
            defaultValue={today}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="planNotes">{t("notes")}</FieldLabel>
          <Input id="planNotes" name="notes" />
        </Field>
      </FieldGroup>
      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}
      {state?.message === "planCreated" ? (
        <p className="text-sm text-green-700">{t("planCreated")}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("createPlan")}
      </Button>
    </form>
  );
}

export function CancelPaymentPlanForm({
  paymentPlanId,
}: {
  paymentPlanId: string;
}) {
  const t = useTranslations("Invoices");
  const [state, action, pending] = useActionState(
    cancelPaymentPlanAction,
    null as InvoiceActionState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="paymentPlanId" value={paymentPlanId} />
      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t("cancelPlan")}
      </Button>
    </form>
  );
}

export function InvoiceLegalSettingsForm({
  legalName,
  taxId,
}: {
  legalName: string;
  taxId: string;
}) {
  const t = useTranslations("Invoices");
  const [state, action, pending] = useActionState(
    updateInvoiceLegalSettingsAction,
    null as InvoiceActionState,
  );

  return (
    <form action={action} className="space-y-3">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="legalName">{t("legalName")}</FieldLabel>
          <Input
            id="legalName"
            name="legalName"
            defaultValue={legalName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="taxId">{t("taxId")}</FieldLabel>
          <Input id="taxId" name="taxId" defaultValue={taxId} />
        </Field>
      </FieldGroup>
      {state?.error ? (
        <FieldError>{mapError(t, state.error)}</FieldError>
      ) : null}
      {state?.message === "settingsSaved" ? (
        <p className="text-sm text-green-700">{t("settingsSaved")}</p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? t("saving") : t("saveSettings")}
      </Button>
    </form>
  );
}

export function formatSeries(year: number, number: number) {
  return formatInvoiceNumber(year, number);
}
