import { routing, type AppLocale } from "./routing";

/**
 * Build a public URL path for middleware redirects and absolute email links.
 * Always includes the locale prefix (`localePrefix: "always"`).
 * Does not localize marketing slugs — use `getPathname` from navigation for those.
 */
export function publicLocalePath(
  locale: string,
  path: `/${string}` | "/",
): string {
  const normalized =
    path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;

  if (normalized === "/") {
    return `/${locale}`;
  }

  return `/${locale}${normalized}`;
}

export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}
