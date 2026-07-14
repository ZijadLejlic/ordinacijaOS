import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqCategories } from "@/components/marketing/faq/faq-categories";
import { FaqHero } from "@/components/marketing/faq/faq-hero";
import { FinalCta } from "@/components/marketing/final-cta";
import { FAQ_CATEGORIES } from "@/lib/marketing/faq";
import { faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "faq");
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Marketing.faq");
  const items = FAQ_CATEGORIES.flatMap((category) =>
    category.items.map((itemKey) => ({
      question: t(`categories.${category.key}.items.${itemKey}.q`),
      answer: t(`categories.${category.key}.items.${itemKey}.a`),
    })),
  );

  return (
    <main className="flex flex-1 flex-col">
      <JsonLd data={faqPageJsonLd(items)} />
      <FaqHero />
      <FaqCategories />
      <FinalCta />
    </main>
  );
}
