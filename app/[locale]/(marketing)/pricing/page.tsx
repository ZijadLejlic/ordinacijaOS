import { getTranslations, setRequestLocale } from "next-intl/server";
import { FinalCta } from "@/components/marketing/final-cta";
import { FeatureCompare } from "@/components/marketing/pricing/feature-compare";
import {
  PRICING_FAQ_KEYS,
  PricingFaq,
} from "@/components/marketing/pricing/pricing-faq";
import { PricingGrid } from "@/components/marketing/pricing/pricing-grid";
import { PricingHero } from "@/components/marketing/pricing/pricing-hero";
import { JsonLd, faqPageJsonLd } from "@/lib/seo/json-ld";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "pricing");
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tFaq = await getTranslations("Marketing.pricing.faq");

  const faqItems = PRICING_FAQ_KEYS.map((key) => ({
    question: tFaq(`items.${key}.q`),
    answer: tFaq(`items.${key}.a`),
  }));

  return (
    <main className="flex flex-1 flex-col">
      <JsonLd data={faqPageJsonLd(faqItems)} />
      <PricingHero />
      <PricingGrid />
      <FeatureCompare />
      <PricingFaq />
      <FinalCta />
    </main>
  );
}
