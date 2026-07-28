"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  createExpenseAction,
  updateExpenseAction,
  voidExpenseAction,
  type ExpenseActionState,
} from "@/lib/expenses/actions";
import { formatMoney, currencyLabel } from "@/lib/money/format";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/validations/expense";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "createFailed",
  "saveFailed",
  "expenseNotFound",
  "alreadyVoid",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Expenses">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  vendor: string | null;
  notes: string | null;
  voidedAt: string | null;
};

function CategorySelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue?: ExpenseCategory;
}) {
  const t = useTranslations("Expenses");
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? "other"}
      className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
    >
      {EXPENSE_CATEGORIES.map((cat) => (
        <option key={cat} value={cat}>
          {t(`categories.${cat}`)}
        </option>
      ))}
    </select>
  );
}

export function ExpenseSearchForm({
  initialQuery,
  initialCategory,
}: {
  initialQuery: string;
  initialCategory: string;
}) {
  const t = useTranslations("Expenses");
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
        name="category"
        defaultValue={initialCategory}
        className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        aria-label={t("categoryFilter")}
      >
        <option value="all">{t("categoryAll")}</option>
        {EXPENSE_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {t(`categories.${cat}`)}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline">
        {t("search")}
      </Button>
    </form>
  );
}

export function CreateExpenseForm() {
  const t = useTranslations("Expenses");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    createExpenseAction,
    null as ExpenseActionState,
  );

  useEffect(() => {
    if (state?.message === "created") {
      formRef.current?.reset();
    }
  }, [state?.message]);

  const error = mapError(t, state?.error);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="category">{t("category")}</FieldLabel>
          <CategorySelect id="category" name="category" />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">{t("description")}</FieldLabel>
          <Input id="description" name="description" required maxLength={500} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="amount">
              {t("amount", { currency: currencyLabel(locale) })}
            </FieldLabel>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="expenseDate">{t("date")}</FieldLabel>
            <Input id="expenseDate" name="expenseDate" type="date" required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="vendor">{t("vendor")}</FieldLabel>
          <Input id="vendor" name="vendor" maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
          <Textarea id="notes" name="notes" rows={2} maxLength={2000} />
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

function EditExpenseForm({ row }: { row: ExpenseRow }) {
  const t = useTranslations("Expenses");
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    updateExpenseAction,
    null as ExpenseActionState,
  );
  const error = mapError(t, state?.error);

  return (
    <form action={action} className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="expenseId" value={row.id} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`cat-${row.id}`}>{t("category")}</FieldLabel>
          <CategorySelect
            id={`cat-${row.id}`}
            name="category"
            defaultValue={row.category}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`desc-${row.id}`}>{t("description")}</FieldLabel>
          <Input
            id={`desc-${row.id}`}
            name="description"
            defaultValue={row.description}
            required
            maxLength={500}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`amt-${row.id}`}>
              {t("amount", { currency: currencyLabel(locale) })}
            </FieldLabel>
            <Input
              id={`amt-${row.id}`}
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={row.amount}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`date-${row.id}`}>{t("date")}</FieldLabel>
            <Input
              id={`date-${row.id}`}
              name="expenseDate"
              type="date"
              defaultValue={row.expenseDate}
              required
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`vendor-${row.id}`}>{t("vendor")}</FieldLabel>
          <Input
            id={`vendor-${row.id}`}
            name="vendor"
            defaultValue={row.vendor ?? ""}
            maxLength={200}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`notes-${row.id}`}>{t("notes")}</FieldLabel>
          <Textarea
            id={`notes-${row.id}`}
            name="notes"
            rows={2}
            defaultValue={row.notes ?? ""}
            maxLength={2000}
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "saved" ? (
        <p className="text-sm text-green-700">{t("saved")}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("save")}
      </Button>
    </form>
  );
}

function VoidExpenseForm({ expenseId }: { expenseId: string }) {
  const t = useTranslations("Expenses");
  const [state, action, pending] = useActionState(
    voidExpenseAction,
    null as ExpenseActionState,
  );
  const error = mapError(t, state?.error);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="expenseId" value={expenseId} />
      <Field className="min-w-[12rem] flex-1">
        <FieldLabel htmlFor={`void-${expenseId}`}>{t("voidReason")}</FieldLabel>
        <Input
          id={`void-${expenseId}`}
          name="reason"
          required
          maxLength={500}
          placeholder={t("voidReasonPlaceholder")}
        />
      </Field>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? t("submitting") : t("void")}
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}

export function ExpensesTable({
  rows,
  canWrite,
}: {
  rows: ExpenseRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Expenses");
  const locale = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colDate")}</TableHead>
            <TableHead>{t("colCategory")}</TableHead>
            <TableHead>{t("colDescription")}</TableHead>
            <TableHead className="text-right">{t("colAmount")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            {canWrite ? <TableHead>{t("colActions")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const voided = Boolean(row.voidedAt);
            return (
              <TableRow key={row.id} className={voided ? "opacity-60" : undefined}>
                <TableCell className="whitespace-nowrap">
                  {row.expenseDate}
                </TableCell>
                <TableCell>{t(`categories.${row.category}`)}</TableCell>
                <TableCell>
                  <div className="max-w-[16rem] truncate">{row.description}</div>
                  {row.vendor ? (
                    <div className="text-muted-foreground text-xs">
                      {row.vendor}
                    </div>
                  ) : null}
                  {editingId === row.id && !voided ? (
                    <div className="mt-3 space-y-3">
                      <EditExpenseForm row={row} />
                      <VoidExpenseForm expenseId={row.id} />
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatMoney(row.amount, locale)}
                </TableCell>
                <TableCell>
                  {voided ? t("statusVoid") : t("statusActive")}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    {!voided ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditingId((id) => (id === row.id ? null : row.id))
                        }
                      >
                        {editingId === row.id ? t("closeEdit") : t("edit")}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ExcelExportLink({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const t = useTranslations("Expenses");
  const href = `/api/reports/excel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return (
    <a
      href={href}
      className="border-border bg-background hover:bg-muted inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium"
    >
      {t("exportExcel")}
    </a>
  );
}
