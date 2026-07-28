import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PRODUCT_URL,
} from "@/lib/brand/constants";
import { MARKETING_PLANS } from "@/lib/marketing/plans";
import {
  amountForLocale,
  currencyForLocale,
} from "@/lib/money/format";

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

/** Renders a single JSON-LD `<script>` block. */
export function JsonLd({ data }: { data: Record<string, JsonLdValue> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Home — SoftwareApplication + plan offers (Website-DentOrd §6.1). */
export function softwareApplicationJsonLd(input: {
  description: string;
  locale: AppLocale;
}) {
  const pricingPath = getPathname({
    locale: input.locale,
    href: "/pricing",
  });
  const pricingUrl = `${PRODUCT_URL}${pricingPath}`;
  const priceCurrency = currencyForLocale(input.locale);

  const offers = MARKETING_PLANS.map((plan) => ({
    "@type": "Offer",
    name: plan.code,
    price: String(amountForLocale(plan.priceMonthly ?? 60, input.locale)),
    priceCurrency,
    url: pricingUrl,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: PRODUCT_URL,
    description: input.description,
    slogan: PRODUCT_TAGLINE,
    offers,
  } satisfies Record<string, JsonLdValue>;
}

/** FAQ page — FAQPage (Website-DentOrd §6.1). */
export function faqPageJsonLd(
  items: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  } satisfies Record<string, JsonLdValue>;
}

/** Blog article — Article (Website-DentOrd §6.1). */
export function articleJsonLd(input: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  locale: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    inLanguage: input.locale,
    author: {
      "@type": "Organization",
      name: PRODUCT_NAME,
      url: PRODUCT_URL,
    },
    publisher: {
      "@type": "Organization",
      name: PRODUCT_NAME,
      url: PRODUCT_URL,
    },
  } satisfies Record<string, JsonLdValue>;
}
