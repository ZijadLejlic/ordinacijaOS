/** Internal pathname keys — localized via next-intl pathnames (Website-DentOrd §3.1). */
export const MARKETING_NAV_LINKS = [
  { href: "/features", labelKey: "features" },
  { href: "/pricing", labelKey: "pricing" },
  { href: "/tour", labelKey: "tour" },
  { href: "/why-dentord", labelKey: "whyDentord" },
  { href: "/faq", labelKey: "faq" },
] as const;

export const MARKETING_FOOTER_PRODUCT = [
  { href: "/features", labelKey: "features" },
  { href: "/pricing", labelKey: "pricing" },
  { href: "/tour", labelKey: "tour" },
  { href: "/demo", labelKey: "demo" },
  { href: "/faq", labelKey: "faq" },
  { href: "/install", labelKey: "install" },
] as const;

export const MARKETING_FOOTER_COMPANY = [
  { href: "/why-dentord", labelKey: "whyDentord" },
  { href: "/blog", labelKey: "blog" },
  { href: "/contact", labelKey: "contact" },
] as const;

export const MARKETING_FOOTER_LEGAL = [
  { href: "/privacy", labelKey: "privacy" },
  { href: "/terms", labelKey: "terms" },
  { href: "/dpa", labelKey: "dpa" },
] as const;

export type MarketingNavLabelKey =
  (typeof MARKETING_NAV_LINKS)[number]["labelKey"];
