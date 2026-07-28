/**
 * Display currency follows UI locale (not DB storage).
 * - bs → BAM (shown as KM)
 * - hr / sr / en → EUR
 *
 * Clinic amounts (invoices, services, …) keep stored numbers — only the
 * currency label changes. Subscription/marketing prices convert EUR→KM.
 */

export type DisplayCurrency = "BAM" | "EUR";

/** Rounded display rate for public subscription prices (15 € → 30 KM). */
export const EUR_TO_KM_DISPLAY_RATE = 2;

export function currencyForLocale(locale: string): DisplayCurrency {
  return locale === "bs" ? "BAM" : "EUR";
}

/** Short label for forms/headers: "KM" | "EUR". */
export function currencyLabel(locale: string): string {
  return currencyForLocale(locale) === "BAM" ? "KM" : "EUR";
}

function localeTag(locale: string): string {
  switch (locale) {
    case "bs":
      return "bs-BA";
    case "hr":
      return "hr-HR";
    case "sr":
      return "sr-Latn-RS";
    default:
      return "en-US";
  }
}

/**
 * Convert a canonical EUR amount into the locale display amount.
 * BS uses rounded 2× KM; other locales stay EUR 1:1.
 */
export function amountForLocale(amountEur: number, locale: string): number {
  if (currencyForLocale(locale) === "BAM") {
    return Math.round(amountEur * EUR_TO_KM_DISPLAY_RATE);
  }
  return amountEur;
}

export function formatMoney(
  amount: number | null | undefined,
  locale: string,
  currency: DisplayCurrency = currencyForLocale(locale),
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency === "BAM" ? "KM" : "EUR"}`;
  }
}

/** Format a subscription/plan price stored in EUR for the active locale. */
export function formatSubscriptionPrice(
  amountEur: number | null | undefined,
  locale: string,
): string {
  if (amountEur == null || Number.isNaN(amountEur)) return "—";
  const amount = amountForLocale(amountEur, locale);
  const currency = currencyForLocale(locale);
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency === "BAM" ? "KM" : "EUR"}`;
  }
}
