import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalDocumentView } from "@/components/marketing/legal/legal-document";
import { getPrivacyDocument } from "@/lib/legal/privacy";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "privacy");
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Marketing.legal");
  const doc = getPrivacyDocument(locale);

  return (
    <main className="flex flex-1 flex-col bg-[var(--marketing-surface)]">
      <LegalDocumentView
        doc={doc}
        lastUpdatedLabel={t("lastUpdated")}
        tocLabel={t("toc")}
      />
    </main>
  );
}
