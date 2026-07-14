import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { MARKETING_PLANS } from "@/lib/marketing/plans";
import { cn } from "@/lib/utils";

function formatLimit(
  value: number | null,
  unlimitedLabel: string,
): string {
  return value === null ? unlimitedLabel : String(value);
}

export async function PricingGrid() {
  const t = await getTranslations("Marketing.pricing");
  const tFeatures = await getTranslations("Marketing.pricing.features");

  return (
    <section className="bg-[var(--marketing-surface)] pb-8 md:pb-12">
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {MARKETING_PLANS.map((plan, index) => (
            <Reveal key={plan.code} delayMs={index * 60}>
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-5 md:p-6",
                  plan.highlighted
                    ? "border-[var(--marketing-accent)] bg-[var(--marketing-wash)] shadow-[0_16px_40px_-20px_rgb(11_110_245_/_0.35)]"
                    : "border-[var(--marketing-mist)] bg-[var(--marketing-surface)]",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--marketing-mist)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--marketing-deep)]">
                    {t("freeBadge")}
                  </span>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-[var(--marketing-accent)] px-2.5 py-0.5 text-[11px] font-medium text-white">
                      {t("popular")}
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-4 text-base font-semibold text-[var(--marketing-ink)]">
                  {t(`plans.${plan.code}.name`)}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]">
                  {t(`plans.${plan.code}.blurb`)}
                </p>

                <p className="mt-5 font-[family-name:var(--font-marketing-display)] text-4xl font-semibold tracking-tight text-[var(--marketing-ink)]">
                  {plan.priceMonthly === null
                    ? t("from", { amount: 60 })
                    : t("perMonth", { amount: plan.priceMonthly })}
                </p>
                <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
                  {t("vat")}
                </p>

                <ul className="mt-5 space-y-2 border-t border-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)] pt-5 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_80%,transparent)]">
                  <li>
                    {t("limits.doctors", {
                      count: formatLimit(
                        plan.limits.doctors,
                        t("limits.unlimited"),
                      ),
                    })}
                  </li>
                  <li>
                    {t("limits.users", {
                      count: formatLimit(
                        plan.limits.users,
                        t("limits.unlimited"),
                      ),
                    })}
                  </li>
                  <li>
                    {t("limits.locations", {
                      count: formatLimit(
                        plan.limits.locations,
                        t("limits.unlimited"),
                      ),
                    })}
                  </li>
                  <li>
                    {t("limits.images", {
                      count: plan.limits.imagesPerPatient,
                    })}
                  </li>
                </ul>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.highlightFeatures.map((featureKey) => (
                    <li
                      key={featureKey}
                      className="flex items-start gap-2 text-sm text-[var(--marketing-ink)]"
                    >
                      <CheckIcon
                        className="mt-0.5 size-4 shrink-0 text-[var(--marketing-accent)]"
                        aria-hidden
                      />
                      <span>{tFeatures(featureKey)}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({
                      variant: plan.highlighted ? "default" : "outline",
                      size: "lg",
                    }),
                    "mt-6 h-11 w-full rounded-[10px]",
                    plan.highlighted
                      ? "bg-[var(--marketing-accent)] text-white hover:bg-[var(--marketing-deep)]"
                      : "border-[color-mix(in_oklab,var(--marketing-ink)_22%,transparent)] bg-transparent text-[var(--marketing-ink)] hover:bg-[var(--marketing-wash)]",
                  )}
                >
                  {t("cta")}
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8 text-center text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
            {t("annualNote")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
