import { setRequestLocale } from "next-intl/server";
import { DemoGallery } from "@/components/marketing/demo/demo-gallery";
import { DemoHero } from "@/components/marketing/demo/demo-hero";
import { DemoLiveCta } from "@/components/marketing/demo/demo-live-cta";
import { FinalCta } from "@/components/marketing/final-cta";
import { isDemoLoginConfigured } from "@/lib/demo/config";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "demo");
}

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <DemoHero />
      <DemoLiveCta available={isDemoLoginConfigured()} />
      <DemoGallery />
      <FinalCta titleKey="demo" />
    </main>
  );
}
