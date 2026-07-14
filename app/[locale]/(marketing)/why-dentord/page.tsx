import { setRequestLocale } from "next-intl/server";
import { FinalCta } from "@/components/marketing/final-cta";
import { BeforeAfter } from "@/components/marketing/why-dentord/before-after";
import { CaseStudiesSection } from "@/components/marketing/why-dentord/case-studies-section";
import { RegionSection } from "@/components/marketing/why-dentord/region-section";
import { RoadmapSection } from "@/components/marketing/why-dentord/roadmap-section";
import { WhyHero } from "@/components/marketing/why-dentord/why-hero";
import { WhySecurity } from "@/components/marketing/why-dentord/why-security";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "whyDentord");
}

export default async function WhyDentordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <WhyHero />
      <BeforeAfter />
      <RegionSection />
      <WhySecurity />
      <RoadmapSection />
      {/* W12 — hidden until real case studies arrive */}
      <CaseStudiesSection />
      <FinalCta />
    </main>
  );
}
