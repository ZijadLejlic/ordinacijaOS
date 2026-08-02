import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardPreview } from "@/components/marketing/home/dashboard-preview";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function HomeHero() {
  const t = await getTranslations("Marketing.home.hero");

  return (
    <section className="relative overflow-hidden">
      {/* Desktop-only LCP preload — mobile keeps H1 as LCP (Website §6.3 lab). */}
      <link
        rel="preload"
        as="image"
        href="/marketing/screenshots/dashboard-lg.webp"
        media="(min-width: 1024px)"
        fetchPriority="high"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 85% 0%, color-mix(in_oklab, var(--marketing-cyan) 28%, transparent), transparent 55%), radial-gradient(ellipse 55% 45% at 5% 80%, color-mix(in_oklab, var(--marketing-accent) 14%, transparent), transparent 50%), linear-gradient(180deg, var(--marketing-surface) 0%, var(--marketing-wash) 100%)",
        }}
      />
      <div
        aria-hidden
        className="marketing-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.22]"
      />

      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 pb-12 pt-8 md:gap-12 md:px-8 md:pb-16 md:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14 lg:pb-20">
        <div className="min-w-0">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--marketing-mist)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--marketing-deep)]">
            <span
              aria-hidden
              className="inline-block size-3.5 shrink-0 rounded-full bg-[var(--marketing-accent)]"
            />
            <span className="truncate">{t("badge")}</span>
          </p>
          <h1 className="mt-6 max-w-xl text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:font-[family-name:var(--font-marketing-display)] md:text-[3.5rem]">
            {t("headline")}
          </h1>
          <p className="mt-5 max-w-[36rem] text-base leading-[1.55] text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)] md:text-xl md:leading-[1.6]">
            {t("support")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 rounded-[10px] bg-[var(--marketing-accent)] px-5 text-white hover:bg-[var(--marketing-deep)]",
              )}
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/tour"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-[10px] border-[color-mix(in_oklab,var(--marketing-ink)_22%,transparent)] bg-transparent px-5 text-[var(--marketing-ink)] hover:bg-white/70",
              )}
            >
              {t("ctaSecondary")}
              <span aria-hidden className="ml-1">
                →
              </span>
            </Link>
          </div>
          <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
            {t("microcopy")}
          </p>
        </div>

        <div className="marketing-hero-visual min-w-0">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
