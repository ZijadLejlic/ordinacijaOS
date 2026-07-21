"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { formatInTimeZone } from "date-fns-tz";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approvePatientErasureAction,
  rejectPatientErasureAction,
  requestPatientErasureAction,
} from "@/lib/privacy/actions";
import type { Json } from "@/lib/supabase/database.types";

const CLINIC_TZ = "Europe/Sarajevo";

type ErasureRow = {
  id: string;
  status: string;
  created_at: string;
  patient_id: string | null;
  patient_snapshot: Json;
  rejection_reason: string | null;
  error_message: string | null;
  completed_at: string | null;
};

function snapshotName(snapshot: Json): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "—";
  }
  const s = snapshot as Record<string, unknown>;
  const first = typeof s.first_name === "string" ? s.first_name : "";
  const last = typeof s.last_name === "string" ? s.last_name : "";
  const name = `${first} ${last}`.trim();
  return name || "—";
}

export function RequestErasureButton({ patientId }: { patientId: string }) {
  const t = useTranslations("Privacy");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      className="w-full sm:w-auto"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("confirmRequest"))) return;
        startTransition(async () => {
          await requestPatientErasureAction(patientId);
          router.refresh();
        });
      }}
    >
      {pending ? t("submitting") : t("requestErasure")}
    </Button>
  );
}

export function ExportPatientLink({ patientId }: { patientId: string }) {
  const t = useTranslations("Privacy");
  return (
    <a
      href={`/api/privacy/patients/${patientId}/export`}
      className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
      download
    >
      {t("exportJson")}
    </a>
  );
}

export function ExportClinicZipLink() {
  const t = useTranslations("Privacy");
  return (
    <a
      href="/api/privacy/clinic/export"
      className={cn(buttonVariants())}
      download
    >
      {t("clinicZipDownload")}
    </a>
  );
}

export function ErasureRequestsTable({
  rows,
  isOwner,
}: {
  rows: ErasureRow[];
  isOwner: boolean;
}) {
  const t = useTranslations("Privacy");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("emptyRequests")}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.patient")}</TableHead>
          <TableHead>{t("columns.status")}</TableHead>
          <TableHead>{t("columns.requestedAt")}</TableHead>
          <TableHead>{t("columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium">{snapshotName(row.patient_snapshot)}</div>
              <div className="text-muted-foreground text-xs">
                {row.patient_id ?? t("patientRemoved")}
              </div>
            </TableCell>
            <TableCell>
              {t(`status.${row.status}` as "status.pending")}
              {row.rejection_reason ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {row.rejection_reason}
                </p>
              ) : null}
              {row.error_message ? (
                <p className="text-destructive mt-1 text-xs">
                  {row.error_message}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatInTimeZone(row.created_at, CLINIC_TZ, "dd.MM.yyyy HH:mm")}
            </TableCell>
            <TableCell>
              {isOwner && row.status === "pending" ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t("confirmApprove"))) return;
                      startTransition(async () => {
                        await approvePatientErasureAction(row.id);
                        router.refresh();
                      });
                    }}
                  >
                    {t("approve")}
                  </Button>
                  <form
                    className="flex gap-2"
                    action={(fd) => {
                      startTransition(async () => {
                        await rejectPatientErasureAction(row.id, fd);
                        router.refresh();
                      });
                    }}
                  >
                    <Input
                      name="reason"
                      placeholder={t("rejectReasonPlaceholder")}
                      className="h-7 text-xs"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                    >
                      {t("reject")}
                    </Button>
                  </form>
                </div>
              ) : row.completed_at ? (
                <span className="text-muted-foreground text-xs">
                  {formatInTimeZone(
                    row.completed_at,
                    CLINIC_TZ,
                    "dd.MM.yyyy HH:mm",
                  )}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
