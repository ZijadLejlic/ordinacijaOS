import { setRequestLocale } from "next-intl/server";
import { FinalCta } from "@/components/marketing/final-cta";
import { TourExperience } from "@/components/marketing/tour/tour-experience";
import { TourHero } from "@/components/marketing/tour/tour-hero";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "tour");
}

export default async function TourPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <TourHero />
      <section className="bg-[var(--marketing-surface)] pb-16 md:pb-24">
        <TourExperience />
      </section>
      <FinalCta titleKey="tour" />
    </main>
  );
}
