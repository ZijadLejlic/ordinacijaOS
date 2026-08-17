import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HtmlLang } from "@/components/i18n/html-lang";
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
  //
  // The cookie-consent banner itself is NOT rendered here (even though this
  // provider carries its translations): it's `position: fixed` at the
  // viewport bottom, and this root layout wraps every route group —
  // (marketing), (auth), (dashboard), (onboarding), (platform). Rendering it
  // here means it overlays authenticated app pages too, where it can sit on
  // top of primary action buttons anchored near the bottom of the viewport
  // (onboarding step 1's "Nastavi", appointment/invoice dialogs, ...) and
  // block clicks until the user notices and dismisses it. See
  // (marketing)/layout.tsx, which renders it for marketing pages only.
  //
  // PostHog + service worker stay out of this layout so /login (and other
  // auth routes) avoid the extra client JS; they mount in (marketing) and
  // (dashboard) instead. Vercel Analytics / Speed Insights stay in root.
  return (
    <NextIntlClientProvider messages={marketingMessages(messages)}>
      <HtmlLang locale={locale} />
      <div className="flex min-h-full flex-1 flex-col">{children}</div>
    </NextIntlClientProvider>
  );
}
