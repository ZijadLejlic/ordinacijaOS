import { defineRouting } from "next-intl/routing";

/**
 * Internal keys are English filesystem paths under `app/[locale]/...`.
 * BS marketing slugs are localized (Website-DentOrd §3.1).
 * Public URLs: `/bs/cijene` ↔ `/en/pricing`.
 *
 * Note: `localePrefix: "as-needed"` (§3.1 unprefixed BS) is blocked by a
 * Next.js 16.2.6+ middleware rewrite→307 bug (vercel/next.js#94342).
 */
export const routing = defineRouting({
  locales: ["bs", "en"],
  defaultLocale: "bs",
  localePrefix: "always",
  /** Stable marketing URLs — no Accept-Language / cookie redirects. */
  localeDetection: false,
  pathnames: {
    "/": "/",

    // Marketing (localized where BS ≠ EN)
    "/features": {
      bs: "/funkcije",
    },
    "/pricing": {
      bs: "/cijene",
    },
    "/why-dentord": {
      bs: "/zasto-dentord",
    },
    "/tour": "/tour",
    "/demo": "/demo",
    "/faq": "/faq",
    "/contact": {
      bs: "/kontakt",
    },
    "/blog": "/blog",
    "/privacy": "/privacy",
    "/terms": "/terms",
    "/dpa": "/dpa",

    // Auth / app (same slug both locales)
    "/login": "/login",
    "/signup": "/signup",
    "/pin": "/pin",
    "/onboarding": "/onboarding",
    "/mfa/enroll": "/mfa/enroll",
    "/mfa/verify": "/mfa/verify",
    "/invite/[token]": "/invite/[token]",

    "/dashboard": "/dashboard",
    "/calendar": "/calendar",
    "/patients": "/patients",
    "/patients/new": "/patients/new",
    "/patients/[patientId]": "/patients/[patientId]",
    "/services": "/services",
    "/invoices": "/invoices",
    "/invoices/[invoiceId]": "/invoices/[invoiceId]",
    "/expenses": "/expenses",
    "/inventory": "/inventory",
    "/crm": "/crm",

    "/settings/users": "/settings/users",
    "/settings/locations": "/settings/locations",
    "/settings/branding": "/settings/branding",
    "/settings/email": "/settings/email",
    "/settings/consent": "/settings/consent",
    "/settings/import": "/settings/import",
    "/settings/audit": "/settings/audit",
    "/settings/privacy": "/settings/privacy",

    "/platform": "/platform",
    "/platform/clinics/[clinicId]": "/platform/clinics/[clinicId]",
  },
});

export type AppLocale = (typeof routing.locales)[number];

export type AppPathname = keyof typeof routing.pathnames;
