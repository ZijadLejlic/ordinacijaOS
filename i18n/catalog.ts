/**
 * Message / content catalog resolution (D37).
 *
 * UI catalogs: `messages/{bs,hr,sr,en}.json`.
 * Blog MDX still only exists under `content/blog/{bs,en}/` — hr/sr reuse BS posts.
 */
export type MessageLocale = "bs" | "hr" | "sr" | "en";

export function catalogLocale(locale: string): MessageLocale {
  if (locale === "en" || locale === "hr" || locale === "sr") return locale;
  return "bs";
}

/** MDX blog directories — dedicated hr/sr posts are optional later. */
export function blogCatalogLocale(locale: string): "bs" | "en" {
  return locale === "en" ? "en" : "bs";
}

/** Open Graph `og:locale` / `alternateLocale` BCP-47-ish tags. */
export function ogLocaleTag(locale: string): string {
  switch (locale) {
    case "en":
      return "en_US";
    case "hr":
      return "hr_HR";
    case "sr":
      return "sr_RS";
    case "bs":
    default:
      return "bs_BA";
  }
}
