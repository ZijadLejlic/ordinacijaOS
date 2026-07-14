"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dismissCrmNotificationAction,
  sendCrmNotificationAction,
} from "@/lib/crm/actions";
import type { CrmNotificationRow } from "@/lib/crm/load";

const KNOWN_ERRORS = [
  "invalid",
  "unauthorized",
  "forbidden",
  "clinicReadonly",
  "clinicPendingDelete",
  "featureDisabled",
  "notFound",
  "notOpen",
  "patientNoEmail",
  "templateNotFound",
  "sendFailed",
] as const;

export function CrmInboxList({
  notifications,
}: {
  notifications: CrmNotificationRow[];
}) {
  const t = useTranslations("Crm");
  const [pending, startTransition] = useTransition();

  if (notifications.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("empty")}
      </p>
    );
  }

  function mapError(error?: string | null) {
    if (!error) return null;
    if ((KNOWN_ERRORS as readonly string[]).includes(error)) {
      return t(`errors.${error as (typeof KNOWN_ERRORS)[number]}`);
    }
    return t("errors.sendFailed");
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.kind")}</TableHead>
          <TableHead>{t("columns.patient")}</TableHead>
          <TableHead>{t("columns.dueOn")}</TableHead>
          <TableHead>{t("columns.email")}</TableHead>
          <TableHead className="text-right">{t("columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifications.map((row) => (
          <CrmRow
            key={row.id}
            row={row}
            pending={pending}
            startTransition={startTransition}
            mapError={mapError}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function CrmRow({
  row,
  pending,
  startTransition,
  mapError,
}: {
  row: CrmNotificationRow;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  mapError: (error?: string | null) => string | null;
}) {
  const t = useTranslations("Crm");
  const name = `${row.patientFirstName} ${row.patientLastName}`.trim();

  return (
    <TableRow>
      <TableCell>{t(`kinds.${row.kind}`)}</TableCell>
      <TableCell>
        <Link
          href={`/patients/${row.patientId}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
      </TableCell>
      <TableCell>{row.dueOn}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {row.patientEmail ?? t("noEmail")}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || !row.patientEmail}
            onClick={() => {
              startTransition(async () => {
                const result = await sendCrmNotificationAction(row.id);
                if (result?.error) {
                  window.alert(mapError(result.error));
                }
              });
            }}
          >
            {t("send")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await dismissCrmNotificationAction(row.id);
                if (result?.error) {
                  window.alert(mapError(result.error));
                }
              });
            }}
          >
            {t("dismiss")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
