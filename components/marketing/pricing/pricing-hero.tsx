import { getTranslations } from "next-intl/server";

export async function PricingHero() {
  const t = await getTranslations("Marketing.pricing");

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 90% 0%, color-mix(in_oklab, var(--marketing-cyan) 22%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 70%, color-mix(in_oklab, var(--marketing-accent) 12%, transparent), transparent 50%), linear-gradient(180deg, var(--marketing-wash) 0%, var(--marketing-surface) 70%)",
        }}
      />
      {/* No Reveal / hero-copy animation — H1 is LCP on this page (Website §6.3). */}
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-10 pt-12 md:px-8 md:pb-14 md:pt-16">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--marketing-deep)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 max-w-3xl text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:font-[family-name:var(--font-marketing-display)] md:text-[3.25rem]">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)] md:text-xl">
          {t("subtitle")}
        </p>
      </div>
    </section>
  );
}
