/**
 * Message / content catalog resolution (D37 strategy B).
 *
 * `hr` and `sr` (Serbian Latin) share the Bosnian (`bs`) catalog and MDX.
 * English stays a separate catalog.
 *
 * TODO: Add real `messages/hr.json` + `messages/sr.json` (and `content/blog/{hr,sr}/`)
 * when dedicated HR/SR translations ship — then stop remapping here.
 */
export function catalogLocale(locale: string): "bs" | "en" {
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
