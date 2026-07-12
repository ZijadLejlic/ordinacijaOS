import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MarketingHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Marketing");

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 70% -10%, color-mix(in_oklab, var(--marketing-accent) 28%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 10% 90%, color-mix(in_oklab, var(--marketing-mist) 80%, transparent), transparent 50%), linear-gradient(165deg, var(--marketing-wash) 0%, var(--marketing-surface) 45%, color-mix(in_oklab, var(--marketing-accent) 8%, var(--marketing-surface)) 100%)",
        }}
      />
      <div
        aria-hidden
        className="marketing-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
      />

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16">
        <p className="font-[family-name:var(--font-marketing-display)] text-[clamp(3.25rem,12vw,7.5rem)] leading-[0.92] tracking-[-0.04em] text-[var(--marketing-ink)]">
          OrdinacijaOS
        </p>
        <h1 className="mt-8 max-w-xl text-2xl font-medium tracking-tight text-[var(--marketing-ink)] md:text-3xl">
          {t("hero.headline")}
        </h1>
        <p className="mt-4 max-w-md text-base text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)] md:text-lg">
          {t("hero.support")}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "min-w-40")}
          >
            {t("hero.ctaPrimary")}
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-[color-mix(in_oklab,var(--marketing-ink)_20%,transparent)] bg-transparent text-[var(--marketing-ink)]",
            )}
          >
            {t("hero.ctaSecondary")}
          </Link>
        </div>
        <p className="mt-6 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_55%,transparent)]">
          {t("hero.trialNote")}
        </p>
      </section>
    </main>
  );
}
