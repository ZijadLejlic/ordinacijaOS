import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["bs", "en"],
  defaultLocale: "bs",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
