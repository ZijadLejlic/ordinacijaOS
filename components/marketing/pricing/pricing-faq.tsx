import { ChevronDownIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

export const PRICING_FAQ_KEYS = [
  "free",
  "card",
  "billing2027",
  "changePlan",
  "limits",
] as const;

export type PricingFaqKey = (typeof PRICING_FAQ_KEYS)[number];

export async function PricingFaq() {
  const t = await getTranslations("Marketing.pricing.faq");

  return (
    <SectionShell tone="white" eyebrow={t("eyebrow")} title={t("title")}>
      <Reveal>
        <div className="mx-auto max-w-3xl divide-y divide-[color-mix(in_oklab,var(--marketing-ink)_10%,transparent)] rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)]">
          {PRICING_FAQ_KEYS.map((key) => (
            <details key={key} className="group px-5 py-1 md:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium text-[var(--marketing-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span>{t(`items.${key}.q`)}</span>
                <ChevronDownIcon className="size-4 shrink-0 text-[var(--marketing-accent)] transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
                {t(`items.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Reveal>
    </SectionShell>
  );
}
