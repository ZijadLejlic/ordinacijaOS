import { getTranslations } from "next-intl/server";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
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

  const items = PRICING_FAQ_KEYS.map((key) => ({
    id: `pricing-${key}`,
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`),
  }));

  return (
    <SectionShell tone="white" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="relative mx-auto max-w-3xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-10 -z-10 h-40 rounded-full opacity-70 blur-3xl md:-inset-x-16"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in_oklab, var(--marketing-accent) 14%, transparent), transparent 70%)",
          }}
        />
        <Reveal>
          <FaqAccordion items={items} source="pricing" />
        </Reveal>
      </div>
    </SectionShell>
  );
}
