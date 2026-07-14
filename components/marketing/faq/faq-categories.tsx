import { ChevronDownIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { FAQ_CATEGORIES } from "@/lib/marketing/faq";

const TONES = ["white", "wash"] as const;

export async function FaqCategories() {
  const t = await getTranslations("Marketing.faq");

  return (
    <>
      {FAQ_CATEGORIES.map((category, index) => (
        <SectionShell
          key={category.key}
          id={category.key}
          tone={TONES[index % 2]}
          eyebrow={t(`categories.${category.key}.eyebrow`)}
          title={t(`categories.${category.key}.title`)}
        >
          <Reveal>
            <div className="mx-auto max-w-3xl divide-y divide-[color-mix(in_oklab,var(--marketing-ink)_10%,transparent)] rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)]">
              {category.items.map((itemKey) => (
                <details key={itemKey} className="group px-5 py-1 md:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium text-[var(--marketing-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
                    <span>
                      {t(`categories.${category.key}.items.${itemKey}.q`)}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 text-[var(--marketing-accent)] transition-transform duration-150 group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
                    {t(`categories.${category.key}.items.${itemKey}.a`)}
                  </p>
                </details>
              ))}
            </div>
          </Reveal>
        </SectionShell>
      ))}
    </>
  );
}
