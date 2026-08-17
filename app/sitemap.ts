import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale, type AppPathname } from "@/i18n/routing";
import { getBlogPosts } from "@/lib/blog/posts";
import { PRODUCT_URL } from "@/lib/brand/constants";
import { MARKETING_SEO_PAGES } from "@/lib/seo/marketing";

const PRIORITY: Partial<Record<keyof typeof MARKETING_SEO_PAGES, number>> = {
  home: 1,
  pricing: 0.9,
  features: 0.9,
  whyDentord: 0.8,
  tour: 0.8,
  demo: 0.8,
  faq: 0.7,
  install: 0.6,
  contact: 0.7,
  blog: 0.5,
  privacy: 0.3,
  terms: 0.3,
  dpa: 0.3,
};

function absolute(locale: AppLocale, pathname: AppPathname) {
  const path = getPathname({
    locale,
    href: pathname as Parameters<typeof getPathname>[0]["href"],
  });
  return `${PRODUCT_URL}${path}`;
}

function absoluteBlog(locale: AppLocale, slug: string) {
  const path = getPathname({
    locale,
    href: { pathname: "/blog/[slug]", params: { slug } },
  });
  return `${PRODUCT_URL}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const [key, pathname] of Object.entries(MARKETING_SEO_PAGES)) {
      entries.push({
        url: absolute(locale, pathname),
        changeFrequency: key === "home" ? "weekly" : "monthly",
        priority: PRIORITY[key as keyof typeof PRIORITY] ?? 0.5,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((loc) => [loc, absolute(loc, pathname)]),
          ),
        },
      });
    }

    for (const post of getBlogPosts(locale)) {
      entries.push({
        url: absoluteBlog(locale, post.slug),
        lastModified: new Date(post.date),
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
  }

  return entries;
}
