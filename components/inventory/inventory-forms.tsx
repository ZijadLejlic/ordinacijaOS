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
  adjustInventoryQtyAction,
  createInventoryItemAction,
  setInventoryItemActiveAction,
  updateInventoryItemAction,
  type InventoryActionState,
} from "@/lib/inventory/actions";
import { isLowStock } from "@/lib/inventory/stock";
import { cn } from "@/lib/utils";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "featureDisabled",
  "clinicReadonly",
  "clinicPendingDelete",
  "createFailed",
  "itemNotFound",
  "saveFailed",
  "insufficientStock",
] as const;

function mapError(
  t: ReturnType<typeof useTranslations<"Inventory">>,
  error?: string | null,
) {
  if (!error) return null;
  if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
    return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
  }
  return t("errors.saveFailed");
}

function mapStateError(
  t: ReturnType<typeof useTranslations<"Inventory">>,
  state: InventoryActionState,
) {
  return mapError(t, state?.error);
}

export type InventoryRow = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  notes: string | null;
  isActive: boolean;
};

export function InventorySearchForm({
  initialQuery,
  initialStatus,
  initialStock,
}: {
  initialQuery: string;
  initialStatus: string;
  initialStock: string;
}) {
  const t = useTranslations("Inventory");
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
      <select
        name="stock"
        defaultValue={initialStock}
        className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        aria-label={t("stockFilter")}
      >
        <option value="all">{t("stockAll")}</option>
        <option value="low">{t("stockLow")}</option>
      </select>
      <Button type="submit" variant="outline">
        {t("search")}
      </Button>
    </form>
  );
}

function ItemFields({ item }: { item?: InventoryRow }) {
  const t = useTranslations("Inventory");
  return (
    <FieldGroup className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
        <Input id="name" name="name" required defaultValue={item?.name} />
      </Field>
      <Field>
        <FieldLabel htmlFor="unit">{t("unit")}</FieldLabel>
        <Input
          id="unit"
          name="unit"
          required
          defaultValue={item?.unit ?? "kom"}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="quantity">{t("quantity")}</FieldLabel>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={item?.quantity ?? 0}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="lowStockThreshold">
          {t("lowStockThreshold")}
        </FieldLabel>
        <Input
          id="lowStockThreshold"
          name="lowStockThreshold"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={item?.lowStockThreshold ?? 0}
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
        <Input id="notes" name="notes" defaultValue={item?.notes ?? ""} />
      </Field>
    </FieldGroup>
  );
}

function CreateItemFormInner({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("Inventory");
  const [state, formAction, pending] = useActionState(
    createInventoryItemAction,
    null,
  );
  const error = mapStateError(t, state);
  const handled = useRef(false);

  useEffect(() => {
    if (state?.message === "created" && !handled.current) {
      handled.current = true;
      onCreated();
    }
  }, [state?.message, onCreated]);

  return (
    <form action={formAction} className="space-y-4">
      <ItemFields />
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("create")}
      </Button>
    </form>
  );
}

export function CreateInventoryItemForm() {
  const t = useTranslations("Inventory");
  const [formKey, setFormKey] = useState(0);
  const [createdFlash, setCreatedFlash] = useState(false);

  return (
    <div className="space-y-4">
      {createdFlash ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("created")}
        </p>
      ) : null}
      <CreateItemFormInner
        key={formKey}
        onCreated={() => {
          setCreatedFlash(true);
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function EditItemForm({
  item,
  onDone,
}: {
  item: InventoryRow;
  onDone: () => void;
}) {
  const t = useTranslations("Inventory");
  const [state, formAction, pending] = useActionState(
    updateInventoryItemAction,
    null,
  );
  const error = mapStateError(t, state);
  const handled = useRef(false);

  useEffect(() => {
    if (state?.message === "saved" && !handled.current) {
      handled.current = true;
      onDone();
    }
  }, [state?.message, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemId" value={item.id} />
      <ItemFields item={item} />
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

function formatQty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function InventoryTable({
  items,
  canWrite,
}: {
  items: InventoryRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("Inventory");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const colCount = canWrite ? 6 : 5;

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <FieldError>{error}</FieldError> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.quantity")}</TableHead>
            <TableHead>{t("columns.threshold")}</TableHead>
            <TableHead>{t("columns.stock")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            {canWrite ? (
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const low = isLowStock(item.quantity, item.lowStockThreshold);
            if (editingId === item.id) {
              return (
                <TableRow key={item.id}>
                  <TableCell colSpan={colCount}>
                    <EditItemForm
                      key={item.id}
                      item={item}
                      onDone={() => setEditingId(null)}
                    />
                  </TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow
                key={item.id}
                className={cn(low && item.isActive && "bg-amber-50/80")}
              >
                <TableCell className="font-medium">
                  {item.name}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({item.unit})
                  </span>
                </TableCell>
                <TableCell>{formatQty(item.quantity)}</TableCell>
                <TableCell>{formatQty(item.lowStockThreshold)}</TableCell>
                <TableCell>
                  {low && item.isActive ? (
                    <span className="text-amber-800 text-sm font-medium">
                      {t("lowStockBadge")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {t("stockOk")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {item.isActive ? t("active") : t("inactive")}
                </TableCell>
                {canWrite ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || item.quantity <= 0}
                        aria-label={t("adjustMinus")}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await adjustInventoryQtyAction(
                              item.id,
                              -1,
                            );
                            if (result?.error) {
                              setError(mapError(t, result.error));
                            } else {
                              setError(null);
                            }
                          })
                        }
                      >
                        −1
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        aria-label={t("adjustPlus")}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await adjustInventoryQtyAction(
                              item.id,
                              1,
                            );
                            if (result?.error) {
                              setError(mapError(t, result.error));
                            } else {
                              setError(null);
                            }
                          })
                        }
                      >
                        +1
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(item.id)}
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
                            const result = await setInventoryItemActiveAction(
                              item.id,
                              !item.isActive,
                            );
                            if (result?.error) {
                              setError(mapError(t, result.error));
                            } else {
                              setError(null);
                            }
                          })
                        }
                      >
                        {item.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    </div>
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
