import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale, type AppPathname } from "@/i18n/routing";
import { BRAND_LOGO, PRODUCT_NAME, PRODUCT_URL } from "@/lib/brand/constants";

export type MarketingMetadataInput = {
  locale: string;
  /** Internal next-intl pathname key (e.g. `/`, `/pricing`). */
  pathname: AppPathname;
  /** Full document title (≤ ~60 chars). Used as absolute title. */
  title: string;
  description: string;
  /** Optional OG/Twitter image path under `public/` or absolute URL. */
  ogImage?: string;
  noIndex?: boolean;
  /** Dynamic route params (e.g. blog slug) for canonical / hreflang. */
  params?: Record<string, string>;
};

/** Production canonical host; override with NEXT_PUBLIC_SITE_URL for local audits. */
function siteOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return fromEnv && fromEnv.length > 0 ? fromEnv : PRODUCT_URL;
}

function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}

function localizedPath(
  locale: AppLocale,
  pathname: AppPathname,
  params?: Record<string, string>,
) {
  if (params && Object.keys(params).length > 0) {
    return getPathname({
      locale,
      href: {
        pathname,
        params,
      } as Parameters<typeof getPathname>[0]["href"],
    });
  }
  return getPathname({
    locale,
    // Static marketing keys; next-intl href union is wider than AppPathname alone.
    href: pathname as Parameters<typeof getPathname>[0]["href"],
  });
}

/** Build Next.js Metadata for marketing pages (W17 — hreflang, canonical, OG). */
export function buildMarketingMetadata(
  input: MarketingMetadataInput,
): Metadata {
  const locale = (
    routing.locales.includes(input.locale as AppLocale)
      ? input.locale
      : routing.defaultLocale
  ) as AppLocale;

  const canonicalPath = localizedPath(locale, input.pathname, input.params);
  const canonical = absoluteUrl(canonicalPath);

  const languages: Record<string, string> = {
    "x-default": absoluteUrl(
      localizedPath(routing.defaultLocale, input.pathname, input.params),
    ),
  };
  for (const loc of routing.locales) {
    languages[loc] = absoluteUrl(
      localizedPath(loc, input.pathname, input.params),
    );
  }

  const ogImage = absoluteUrl(input.ogImage ?? BRAND_LOGO.fullPng);

  return {
    title: { absolute: input.title },
    description: input.description,
    metadataBase: new URL(siteOrigin()),
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: PRODUCT_NAME,
      title: input.title,
      description: input.description,
      locale: locale === "bs" ? "bs_BA" : "en_US",
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => (l === "bs" ? "bs_BA" : "en_US")),
      images: [
        {
          url: ogImage,
          alt: PRODUCT_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
