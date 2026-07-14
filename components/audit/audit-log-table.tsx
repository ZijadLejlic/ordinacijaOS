"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatInTimeZone } from "date-fns-tz";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEventRow } from "@/lib/audit/load";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const CLINIC_TZ = "Europe/Sarajevo";

function formatPayload(payload: Json): string {
  if (payload == null) return "—";
  if (typeof payload !== "object" || Array.isArray(payload)) {
    return JSON.stringify(payload);
  }

  const obj = payload as Record<string, Json | undefined>;
  const oldVal = obj.old ?? obj.before ?? obj.old_value;
  const newVal = obj.new ?? obj.after ?? obj.new_value;

  if (oldVal !== undefined || newVal !== undefined) {
    const parts: string[] = [];
    if (oldVal !== undefined) parts.push(`old: ${JSON.stringify(oldVal)}`);
    if (newVal !== undefined) parts.push(`new: ${JSON.stringify(newVal)}`);
    const rest = Object.entries(obj).filter(
      ([k]) =>
        !["old", "new", "before", "after", "old_value", "new_value"].includes(
          k,
        ),
    );
    if (rest.length) {
      parts.push(
        rest.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", "),
      );
    }
    return parts.join(" · ");
  }

  return Object.entries(obj)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
}

export function AuditLogTable({
  rows,
  page,
  total,
  pageSize,
  eventName,
}: {
  rows: AuditEventRow[];
  page: number;
  total: number;
  pageSize: number;
  eventName: string | null;
}) {
  const t = useTranslations("AuditLog");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const queryFor = useMemo(() => {
    return (nextPage: number) => {
      const query: Record<string, string> = {};
      if (eventName) query.event = eventName;
      if (nextPage > 1) query.page = String(nextPage);
      return {
        pathname: "/settings/audit" as const,
        query,
      };
    };
  }, [eventName]);

  function eventLabel(name: string) {
    const key = `events.${name}`;
    return t.has(key) ? t(key as Parameters<typeof t>[0]) : name;
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.when")}</TableHead>
            <TableHead>{t("columns.actor")}</TableHead>
            <TableHead>{t("columns.event")}</TableHead>
            <TableHead>{t("columns.details")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const actor =
              row.actor_name ??
              (row.actor_user_id ? row.actor_user_id.slice(0, 8) : "—");
            const withOperator = row.operator_name
              ? `${actor} · ${row.operator_name}`
              : actor;

            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap align-top">
                  {formatInTimeZone(
                    row.created_at,
                    CLINIC_TZ,
                    "dd.MM.yyyy HH:mm",
                  )}
                </TableCell>
                <TableCell className="align-top">{withOperator}</TableCell>
                <TableCell className="align-top">
                  <span className="font-medium">
                    {eventLabel(row.event_name)}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {row.event_name}
                  </span>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal align-top text-xs break-words">
                  {formatPayload(row.payload_json)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("pageInfo", { page, totalPages, total })}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={queryFor(page - 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("prev")}
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={queryFor(page + 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("next")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
