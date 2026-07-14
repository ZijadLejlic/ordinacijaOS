import { setRequestLocale } from "next-intl/server";
import { ContactChannels } from "@/components/marketing/contact/contact-channels";
import { ContactHero } from "@/components/marketing/contact/contact-hero";
import { FinalCta } from "@/components/marketing/final-cta";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "contact");
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <ContactHero />
      <ContactChannels />
      <FinalCta titleKey="contact" />
    </main>
  );
}
