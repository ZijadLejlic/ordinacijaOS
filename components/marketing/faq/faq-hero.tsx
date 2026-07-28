import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";

export async function FaqHero() {
  const t = await getTranslations("Marketing.faq");

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 85% -10%, color-mix(in_oklab, var(--marketing-cyan) 28%, transparent), transparent 55%), radial-gradient(ellipse 50% 45% at 5% 80%, color-mix(in_oklab, var(--marketing-accent) 14%, transparent), transparent 50%), linear-gradient(180deg, var(--marketing-wash) 0%, var(--marketing-surface) 55%, var(--marketing-wash) 100%)",
        }}
      />
      <div
        aria-hidden
        className="marketing-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
      />
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-6 pt-12 md:px-8 md:pb-8 md:pt-16">
        <Reveal>
          <div className="marketing-hero-copy mx-auto max-w-3xl text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--marketing-deep)]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-marketing-display)] text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[3.25rem] md:leading-[1.08]">
              {t("title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)] md:text-xl">
              {t("subtitle")}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
