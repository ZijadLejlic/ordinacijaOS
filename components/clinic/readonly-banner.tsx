"use client";

import { useTranslations } from "next-intl";
import { formatInTimeZone } from "date-fns-tz";
import { Link } from "@/i18n/navigation";
import type { Database } from "@/lib/supabase/database.types";

const CLINIC_TZ = "Europe/Sarajevo";

type ClinicStatus = Database["public"]["Enums"]["clinic_status"];

type Props = {
  status: ClinicStatus;
  graceEndsAt: string | null;
  isOwner: boolean;
};

export function ClinicReadonlyBanner({
  status,
  graceEndsAt,
  isOwner,
}: Props) {
  const t = useTranslations("ClinicLifecycle");

  if (status === "active") return null;

  const graceLabel = graceEndsAt
    ? formatInTimeZone(graceEndsAt, CLINIC_TZ, "dd.MM.yyyy HH:mm")
    : null;

  const title =
    status === "pending_delete"
      ? t("pendingDeleteTitle")
      : t("readonlyTitle");

  const body =
    status === "pending_delete"
      ? t("pendingDeleteBody")
      : graceLabel
        ? t("readonlyBodyWithGrace", { date: graceLabel })
        : t("readonlyBody");

  return (
    <div
      role="status"
      className="border-b border-amber-700/30 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm opacity-90">{body}</p>
        </div>
        {isOwner ? (
          <Link
            href="/settings/privacy"
            className="text-sm font-medium underline underline-offset-4"
          >
            {t("exportCta")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
