import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CookieConsentBanner } from "@/components/analytics/cookie-consent-banner";
import { PosthogProvider } from "@/components/analytics/posthog-provider";
import { routing } from "@/i18n/routing";
import { marketingMessages } from "@/lib/i18n/client-messages";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  // Default client catalog is Marketing-only (cookie banner + marketing pages).
  // App / auth / platform layouts nest a fuller NextIntlClientProvider.
  return (
    <NextIntlClientProvider messages={marketingMessages(messages)}>
      <PosthogProvider>
        <div className="flex min-h-full flex-1 flex-col">{children}</div>
        <CookieConsentBanner />
      </PosthogProvider>
    </NextIntlClientProvider>
  );
}
