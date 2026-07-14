import { getTranslations } from "next-intl/server";
import type { AppPathname } from "@/i18n/routing";
import { buildMarketingMetadata } from "@/lib/seo/metadata";
import { marketingOgImagePath } from "@/lib/seo/og";

/** Marketing routes that expose SEO copy under `Marketing.seo.*`. */
export const MARKETING_SEO_PAGES = {
  home: "/",
  pricing: "/pricing",
  features: "/features",
  whyDentord: "/why-dentord",
  tour: "/tour",
  demo: "/demo",
  faq: "/faq",
  contact: "/contact",
  blog: "/blog",
  privacy: "/privacy",
  terms: "/terms",
  dpa: "/dpa",
} as const satisfies Record<string, AppPathname>;

export type MarketingSeoPage = keyof typeof MARKETING_SEO_PAGES;

export async function generateMarketingMetadata(
  locale: string,
  page: MarketingSeoPage,
) {
  const t = await getTranslations({ locale, namespace: "Marketing.seo" });
  const title = t(`${page}.title`);
  return buildMarketingMetadata({
    locale,
    pathname: MARKETING_SEO_PAGES[page],
    title,
    description: t(`${page}.description`),
    ogImage: marketingOgImagePath(title),
  });
}
