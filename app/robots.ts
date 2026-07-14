import type { MetadataRoute } from "next";
import { PRODUCT_URL } from "@/lib/brand/constants";

const APP_SEGMENTS = [
  "dashboard",
  "settings",
  "patients",
  "calendar",
  "invoices",
  "expenses",
  "inventory",
  "crm",
  "platform",
  "onboarding",
  "pin",
  "mfa",
  "invite",
] as const;

export default function robots(): MetadataRoute.Robots {
  // localePrefix: "always" → paths are `/bs/...` and `/en/...`
  const disallow = [
    "/api/",
    ...APP_SEGMENTS.flatMap((seg) => [`/bs/${seg}`, `/en/${seg}`]),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${PRODUCT_URL}/sitemap.xml`,
  };
}
