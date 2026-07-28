import { AlertTriangleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AllergyRow } from "@/components/patients/patient-forms";
import { cn } from "@/lib/utils";

const SEVERITY_RANK: Record<AllergyRow["severity"], number> = {
  severe: 0,
  moderate: 1,
  mild: 2,
  unknown: 3,
};

export async function AllergyWarningBanner({
  allergies,
}: {
  allergies: AllergyRow[];
}) {
  if (allergies.length === 0) return null;

  const t = await getTranslations("Patients");
  const sorted = [...allergies].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  const hasSevere = sorted.some((a) => a.severity === "severe");

  return (
    <aside
      role="alert"
      data-testid="patient-allergy-warning"
      className={cn(
        "rounded-xl border px-4 py-3",
        hasSevere
          ? "border-rose-700/35 bg-rose-50 text-rose-950 dark:border-rose-400/25 dark:bg-rose-950/45 dark:text-rose-50"
          : "border-amber-700/30 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-50",
      )}
    >
      <div className="flex gap-3">
        <AlertTriangleIcon
          className="mt-0.5 size-5 shrink-0"
          aria-hidden
        />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold tracking-tight">
            {t("allergyWarningTitle")}
          </p>
          <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
            {sorted.map((allergy) => (
              <li key={allergy.id} className="text-sm">
                <span className="font-medium">{allergy.allergen}</span>
                <span className="opacity-80">
                  {" "}
                  ({t(`severityLevels.${allergy.severity}`)})
                </span>
                {allergy.notes ? (
                  <span className="opacity-70"> — {allergy.notes}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
