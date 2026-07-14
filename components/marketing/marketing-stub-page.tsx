import { getTranslations, setRequestLocale } from "next-intl/server";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionShell } from "@/components/marketing/section-shell";
import {
  generateMarketingMetadata,
  type MarketingSeoPage,
} from "@/lib/seo/marketing";

export type MarketingStubPageKey =
  | "features"
  | "whyDentord"
  | "tour"
  | "demo"
  | "faq"
  | "contact"
  | "blog"
  | "privacy"
  | "terms"
  | "dpa";

type Props = {
  params: Promise<{ locale: string }>;
  pageKey: MarketingStubPageKey;
  finalCtaKey?: "default" | "demo" | "contact" | "tour";
};

export async function generateStubMetadata(
  locale: string,
  pageKey: MarketingStubPageKey,
) {
  return generateMarketingMetadata(locale, pageKey as MarketingSeoPage);
}

export async function MarketingStubPage({
  params,
  pageKey,
  finalCtaKey = "default",
}: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`Marketing.pages.${pageKey}`);

  return (
    <main className="flex flex-1 flex-col">
      <SectionShell
        tone="wash"
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      >
        <p className="max-w-[65ch] text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)] md:text-base">
          {t("comingSoon")}
        </p>
      </SectionShell>
      <FinalCta titleKey={finalCtaKey} />
    </main>
  );
}
