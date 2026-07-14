import { setRequestLocale } from "next-intl/server";
import { FeatureModules } from "@/components/marketing/features/feature-modules";
import { FeaturesHero } from "@/components/marketing/features/features-hero";
import { FinalCta } from "@/components/marketing/final-cta";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "features");
}

export default async function FeaturesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <FeaturesHero />
      <FeatureModules />
      <FinalCta />
    </main>
  );
}
