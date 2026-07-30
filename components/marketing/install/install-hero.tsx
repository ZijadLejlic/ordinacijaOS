import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";

export async function InstallHero() {
  const t = await getTranslations("Marketing.install");

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
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-10 pt-12 md:px-8 md:pb-14 md:pt-16">
        <Reveal>
          <div className="marketing-hero-copy">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-marketing-display)] text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[3.25rem] md:leading-[1.08]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)] md:text-xl">
              {t("subtitle")}
            </p>
            <ul className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {(["benefit1", "benefit2", "benefit3"] as const).map((key) => (
                <li
                  key={key}
                  className="rounded-xl border border-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)] bg-white/70 px-4 py-3 text-sm leading-snug text-[color-mix(in_oklab,var(--marketing-ink)_78%,transparent)]"
                >
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
