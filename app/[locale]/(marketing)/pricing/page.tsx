import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { MARKETING_PLANS } from "@/lib/marketing/plans";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Marketing");

  return (
    <main className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, var(--marketing-wash) 0%, var(--marketing-surface) 40%, var(--marketing-surface) 100%)",
        }}
      />

      <section className="mx-auto w-full max-w-5xl px-6 py-14 md:px-10 md:py-20">
        <h1 className="font-[family-name:var(--font-marketing-display)] text-4xl tracking-tight text-[var(--marketing-ink)] md:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mt-3 max-w-xl text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
          {t("pricing.subtitle")}
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {MARKETING_PLANS.map((plan) => (
            <div
              key={plan.code}
              className={cn(
                "flex flex-col border-t-2 pt-5",
                plan.highlighted
                  ? "border-[var(--marketing-accent)]"
                  : "border-[color-mix(in_oklab,var(--marketing-ink)_18%,transparent)]",
              )}
            >
              <p className="text-sm font-medium uppercase tracking-wide text-[color-mix(in_oklab,var(--marketing-ink)_60%,transparent)]">
                {t(`pricing.plans.${plan.code}.name`)}
              </p>
              <p className="mt-3 font-[family-name:var(--font-marketing-display)] text-3xl text-[var(--marketing-ink)]">
                {plan.priceMonthly === null
                  ? t("pricing.custom")
                  : t("pricing.price", { amount: plan.priceMonthly })}
              </p>
              <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]">
                {t(`pricing.plans.${plan.code}.blurb`)}
              </p>
              <ul className="mt-6 space-y-2 text-sm text-[var(--marketing-ink)]">
                <li>
                  {t("pricing.limits.doctors", { count: plan.limits.doctors })}
                </li>
                <li>
                  {t("pricing.limits.users", { count: plan.limits.users })}
                </li>
                <li>
                  {t("pricing.limits.locations", {
                    count: plan.limits.locations,
                  })}
                </li>
              </ul>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({
                    variant: plan.highlighted ? "default" : "outline",
                  }),
                  "mt-8 w-full",
                  !plan.highlighted &&
                    "border-[color-mix(in_oklab,var(--marketing-ink)_20%,transparent)] text-[var(--marketing-ink)]",
                )}
              >
                {t("pricing.cta")}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_55%,transparent)]">
          {t("pricing.vatNote")}
        </p>
      </section>
    </main>
  );
}
