import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { catalogLocale } from "./catalog";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Strategy B: hr/sr load the bs catalog (see i18n/catalog.ts TODO).
  const messages = (await import(`../messages/${catalogLocale(locale)}.json`))
    .default;

  return {
    locale,
    messages,
  };
});
