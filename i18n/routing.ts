import { defineRouting } from "next-intl/routing";

/**
 * Internal keys are English filesystem paths under `app/[locale]/...`.
 * Balkan marketing slugs (bs/hr/sr) are localized (Website-DentOrd §3.1).
 * Public URLs: `/bs/cijene` ↔ `/hr/cijene` ↔ `/sr/cijene` ↔ `/en/pricing`.
 *
 * Content strategy B (D37): hr/sr reuse BS message catalog + BS pathnames
 * until dedicated translations exist (see `i18n/catalog.ts`).
 *
 * Note: `localePrefix: "as-needed"` (§3.1 unprefixed BS) is blocked by a
 * Next.js 16.2.6+ middleware rewrite→307 bug (vercel/next.js#94342).
 * Production `npm start` sets `HOSTNAME=localhost` so localized BS slugs
 * (`/bs/cijene` → `/bs/pricing`) stay internal rewrites.
 */

/** Shared Balkan marketing slugs (bs + hr + sr). */
const balkan = <T extends string>(path: T) =>
  ({ bs: path, hr: path, sr: path }) as const;

export const routing = defineRouting({
  locales: ["bs", "hr", "sr", "en"],
  defaultLocale: "bs",
  localePrefix: "always",
  /** Stable marketing URLs — no Accept-Language / cookie redirects. */
  localeDetection: false,
  pathnames: {
    "/": "/",

    // Marketing (localized where Balkan ≠ EN)
    "/features": balkan("/funkcije"),
    "/pricing": balkan("/cijene"),
    "/why-dentord": balkan("/zasto-dentord"),
    "/tour": "/tour",
    "/demo": "/demo",
    "/faq": "/faq",
    "/contact": balkan("/kontakt"),
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/privacy": "/privacy",
    "/terms": "/terms",
    "/dpa": "/dpa",

    // Auth / app (same slug all locales)
    "/login": "/login",
    "/signup": "/signup",
    "/forgot-password": "/forgot-password",
    "/reset-password": "/reset-password",
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
