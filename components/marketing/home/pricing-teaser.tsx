import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { buttonVariants } from "@/components/ui/button";
import { MARKETING_PLANS } from "@/lib/marketing/plans";
import { formatSubscriptionPrice } from "@/lib/money/format";
import { cn } from "@/lib/utils";

export async function PricingTeaser() {
  const t = await getTranslations("Marketing.home.pricing");
  const tPlans = await getTranslations("Marketing.pricing.plans");
  const locale = await getLocale();

  return (
    <SectionShell tone="white" eyebrow={t("eyebrow")} title={t("title")}>
      <p className="mb-8 inline-flex rounded-full bg-[var(--marketing-mist)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--marketing-deep)]">
        {t("badge")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETING_PLANS.map((plan, index) => (
          <Reveal key={plan.code} delayMs={index * 70}>
            <article
              className={cn(
                "relative flex h-full flex-col rounded-2xl border p-5",
                plan.highlighted
                  ? "border-[var(--marketing-accent)] bg-[var(--marketing-wash)] shadow-[0_16px_40px_-20px_rgb(11_110_245_/_0.35)]"
                  : "border-[var(--marketing-mist)] bg-[var(--marketing-surface)]",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-2.5 right-4 rounded-full bg-[var(--marketing-accent)] px-2.5 py-0.5 text-[11px] font-medium text-white">
                  {t("popular")}
                </span>
              ) : null}
              <p className="text-sm font-medium text-[color-mix(in_oklab,var(--marketing-ink)_60%,transparent)]">
                {tPlans(`${plan.code}.name`)}
              </p>
              <p className="mt-3 font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-[var(--marketing-ink)]">
                {plan.priceMonthly === null
                  ? t("from", {
                      price: formatSubscriptionPrice(60, locale),
                    })
                  : t("perMonth", {
                      price: formatSubscriptionPrice(
                        plan.priceMonthly,
                        locale,
                      ),
                    })}
              </p>
              <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
                {t("vat")}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
                {tPlans(`${plan.code}.blurb`)}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-10 h-11 rounded-[10px] border-[color-mix(in_oklab,var(--marketing-ink)_22%,transparent)] bg-transparent px-5 text-[var(--marketing-ink)] hover:bg-[var(--marketing-wash)]",
          )}
        >
          {t("cta")}
          <span aria-hidden className="ml-1">
            →
          </span>
        </Link>
      </Reveal>
    </SectionShell>
  );
}
