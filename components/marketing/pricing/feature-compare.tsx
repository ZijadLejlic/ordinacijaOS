import { CheckIcon, MinusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import {
  MARKETING_FEATURE_ROWS,
  MARKETING_PLAN_CODES,
  type MarketingFeatureAvailability,
  type MarketingPlanCode,
} from "@/lib/marketing/plans";
import { cn } from "@/lib/utils";

function CellValue({
  value,
  meteredLabel,
}: {
  value: MarketingFeatureAvailability;
  meteredLabel: string;
}) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center justify-center text-[var(--marketing-accent)]">
        <CheckIcon className="size-4" aria-label="✓" />
      </span>
    );
  }
  if (value === "metered") {
    return (
      <span className="text-xs font-medium text-[var(--marketing-deep)]">
        {meteredLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-[color-mix(in_oklab,var(--marketing-ink)_28%,transparent)]">
      <MinusIcon className="size-4" aria-label="—" />
    </span>
  );
}

function PlanFeatureList({
  planCode,
  tFeatures,
  tAvailability,
}: {
  planCode: MarketingPlanCode;
  tFeatures: (key: string) => string;
  tAvailability: (key: "yes" | "no" | "metered") => string;
}) {
  return (
    <ul className="divide-y divide-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)]">
      {MARKETING_FEATURE_ROWS.map(({ key, availability }) => {
        const value = availability[planCode];
        return (
          <li
            key={key}
            className="flex items-center justify-between gap-3 py-2.5 text-sm"
          >
            <span
              className={cn(
                value === "no"
                  ? "text-[color-mix(in_oklab,var(--marketing-ink)_45%,transparent)]"
                  : "text-[var(--marketing-ink)]",
              )}
            >
              {tFeatures(key)}
            </span>
            <CellValue value={value} meteredLabel={tAvailability("metered")} />
          </li>
        );
      })}
    </ul>
  );
}

export async function FeatureCompare() {
  const t = await getTranslations("Marketing.pricing");
  const tFeatures = await getTranslations("Marketing.pricing.features");
  const tPlans = await getTranslations("Marketing.pricing.plans");

  return (
    <SectionShell
      tone="wash"
      eyebrow={t("compare.eyebrow")}
      title={t("compare.title")}
      description={t("compare.description")}
    >
      {/* Desktop table */}
      <Reveal>
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] md:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--marketing-mist)] bg-[var(--marketing-wash)]">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-[var(--marketing-wash)] px-4 py-3.5 font-medium text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]"
                >
                  {t("compare.featureColumn")}
                </th>
                {MARKETING_PLAN_CODES.map((code) => (
                  <th
                    key={code}
                    scope="col"
                    className={cn(
                      "px-3 py-3.5 text-center font-semibold text-[var(--marketing-ink)]",
                      code === "professional" && "text-[var(--marketing-accent)]",
                    )}
                  >
                    {tPlans(`${code}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MARKETING_FEATURE_ROWS.map(({ key, availability }, rowIndex) => (
                <tr
                  key={key}
                  className={cn(
                    "border-b border-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] last:border-0",
                    rowIndex % 2 === 1 && "bg-[var(--marketing-wash)]/50",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 px-4 py-3 font-normal text-[var(--marketing-ink)]",
                      rowIndex % 2 === 1
                        ? "bg-[var(--marketing-wash)]"
                        : "bg-[var(--marketing-surface)]",
                    )}
                  >
                    {tFeatures(key)}
                  </th>
                  {MARKETING_PLAN_CODES.map((code) => (
                    <td key={code} className="px-3 py-3 text-center">
                      <CellValue
                        value={availability[code]}
                        meteredLabel={t("availability.metered")}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Mobile accordion per plan */}
      <Reveal>
        <div className="space-y-3 md:hidden">
          {MARKETING_PLAN_CODES.map((code) => (
            <details
              key={code}
              className="group rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] open:shadow-sm"
              open={code === "professional"}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-[var(--marketing-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span
                  className={cn(
                    code === "professional" && "text-[var(--marketing-accent)]",
                  )}
                >
                  {tPlans(`${code}.name`)}
                </span>
                <span className="text-xs font-medium text-[color-mix(in_oklab,var(--marketing-ink)_45%,transparent)] group-open:hidden">
                  {t("compare.expand")}
                </span>
                <span className="hidden text-xs font-medium text-[color-mix(in_oklab,var(--marketing-ink)_45%,transparent)] group-open:inline">
                  {t("compare.collapse")}
                </span>
              </summary>
              <div className="border-t border-[var(--marketing-mist)] px-4 pb-3">
                <PlanFeatureList
                  planCode={code}
                  tFeatures={tFeatures}
                  tAvailability={(k) => t(`availability.${k}`)}
                />
              </div>
            </details>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <p className="mt-6 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
          {t("compare.footnote")}
        </p>
      </Reveal>
    </SectionShell>
  );
}
