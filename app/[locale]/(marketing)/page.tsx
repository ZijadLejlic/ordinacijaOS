import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { FinalCta } from "@/components/marketing/final-cta";
import { FaqTeaser } from "@/components/marketing/home/faq-teaser";
import { FeatureGrid } from "@/components/marketing/home/feature-grid";
import { HomeHero } from "@/components/marketing/home/home-hero";
import { PricingTeaser } from "@/components/marketing/home/pricing-teaser";
import { ProblemSolution } from "@/components/marketing/home/problem-solution";
import { SecuritySection } from "@/components/marketing/home/security-section";
import { TestimonialsSection } from "@/components/marketing/home/testimonials-section";
import { TourTeaser } from "@/components/marketing/home/tour-teaser";
import { TrustBar } from "@/components/marketing/home/trust-bar";
import { JsonLd, softwareApplicationJsonLd } from "@/lib/seo/json-ld";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "home");
}

export default async function MarketingHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tSeo = await getTranslations("Marketing.seo");

  return (
    <main className="flex flex-1 flex-col">
      <JsonLd
        data={softwareApplicationJsonLd({
          description: tSeo("home.description"),
          locale: locale as AppLocale,
        })}
      />
      <HomeHero />
      <TrustBar />
      <ProblemSolution />
      <FeatureGrid />
      <TourTeaser />
      <SecuritySection />
      <PricingTeaser />
      <TestimonialsSection />
      <FaqTeaser />
      <FinalCta />
    </main>
  );
}
