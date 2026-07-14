"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestClinicClosureAction } from "@/lib/clinic/actions";
import type { Database } from "@/lib/supabase/database.types";

const CLINIC_TZ = "Europe/Sarajevo";

type ClinicStatus = Database["public"]["Enums"]["clinic_status"];

type Props = {
  clinicName: string;
  status: ClinicStatus;
  graceEndsAt: string | null;
};

export function CloseClinicAccountCard({
  clinicName,
  status,
  graceEndsAt,
}: Props) {
  const t = useTranslations("ClinicLifecycle");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status !== "active") {
    const graceLabel = graceEndsAt
      ? formatInTimeZone(graceEndsAt, CLINIC_TZ, "dd.MM.yyyy HH:mm")
      : null;

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          {status === "pending_delete"
            ? t("pendingDeleteTitle")
            : t("closureInProgressTitle")}
        </p>
        <p className="text-muted-foreground text-sm">
          {graceLabel
            ? t("closureInProgressBody", { date: graceLabel })
            : t("pendingDeleteBody")}
        </p>
      </div>
    );
  }

  const matches = confirmName.trim() === clinicName.trim();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{t("closeHint")}</p>
      <p className="text-muted-foreground text-sm">{t("closeConfirmPrompt")}</p>
      <Input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={clinicName}
        autoComplete="off"
      />
      {error ? (
        <p className="text-destructive text-sm">
          {t(`errors.${error}` as "errors.closureFailed")}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="destructive"
          disabled={pending || !matches}
          onClick={() => {
            if (!window.confirm(t("closeConfirm"))) return;
            setError(null);
            startTransition(async () => {
              const result = await requestClinicClosureAction();
              if (result?.error) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? t("closing") : t("closeAccount")}
        </Button>
      </div>
    </div>
  );
}
