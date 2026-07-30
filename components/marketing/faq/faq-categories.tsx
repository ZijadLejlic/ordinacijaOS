import { getTranslations } from "next-intl/server";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FaqCategoryNav } from "@/components/marketing/faq/faq-category-nav";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { FAQ_CATEGORIES } from "@/lib/marketing/faq";

export async function FaqCategories() {
  const t = await getTranslations("Marketing.faq");

  const navCategories = FAQ_CATEGORIES.map((category) => ({
    key: category.key,
    label: t(`categories.${category.key}.eyebrow`),
  }));

  return (
    <SectionShell
      tone="wash"
      className="pt-4 md:pt-6"
      innerClassName="relative"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
        style={{
          background:
            "radial-gradient(ellipse 55% 80% at 10% 0%, color-mix(in_oklab, var(--marketing-cyan) 16%, transparent), transparent 60%), radial-gradient(ellipse 45% 70% at 90% 10%, color-mix(in_oklab, var(--marketing-accent) 12%, transparent), transparent 55%)",
        }}
      />

      <FaqCategoryNav
        categories={navCategories}
        ariaLabel={t("navAria")}
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-16 md:gap-20">
        {FAQ_CATEGORIES.map((category, categoryIndex) => {
          const items = category.items.map((itemKey) => {
            const base = {
              id: `${category.key}-${itemKey}`,
              question: t(`categories.${category.key}.items.${itemKey}.q`),
              answer: t(`categories.${category.key}.items.${itemKey}.a`),
            };
            if (category.key === "usage" && itemKey === "mobile") {
              return {
                ...base,
                link: {
                  href: "/install" as const,
                  label: t("categories.usage.items.mobile.linkLabel"),
                },
              };
            }
            return base;
          });

          return (
            <Reveal key={category.key} delayMs={categoryIndex * 40}>
              <section
                id={category.key}
                className="scroll-mt-36 md:scroll-mt-40"
              >
                <header className="mb-6 md:mb-8">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--marketing-deep)]">
                    {t(`categories.${category.key}.eyebrow`)}
                  </p>
                  <h2 className="mt-2 font-[family-name:var(--font-marketing-display)] text-[1.5rem] leading-tight font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[2rem]">
                    {t(`categories.${category.key}.title`)}
                  </h2>
                </header>
                <FaqAccordion items={items} source="faq" />
              </section>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}
