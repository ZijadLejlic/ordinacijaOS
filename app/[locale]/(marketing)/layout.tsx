import { Fraunces } from "next/font/google";
import { setRequestLocale } from "next-intl/server";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { CookieConsentBannerLazy } from "@/components/analytics/cookie-consent-banner-lazy";
import { PosthogProvider } from "@/components/analytics/posthog-provider";
import { RegisterServiceWorkerLazy } from "@/components/pwa/register-sw-lazy";
import { shouldShowBlogInNav } from "@/lib/blog/posts";
import type { AppLocale } from "@/i18n/routing";

const marketingDisplay = Fraunces({
  variable: "--font-marketing-display",
  subsets: ["latin"],
  display: "optional",
  adjustFontFallback: true,
  // Display face applies from `md:` up; skip preload so Slow-4G mobile LCP
  // (usually the H1 in the UI stack font) isn't fighting the webfont download.
  preload: false,
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const showBlogNav = shouldShowBlogInNav(locale as AppLocale);

  return (
    <PosthogProvider>
      <RegisterServiceWorkerLazy />
      <div
        className={`${marketingDisplay.variable} marketing-shell flex min-h-full flex-1 flex-col`}
      >
        <MarketingHeader showBlogNav={showBlogNav} />
        <div className="flex flex-1 flex-col">{children}</div>
        <MarketingFooter />
        <CookieConsentBannerLazy />
      </div>
    </PosthogProvider>
  );
}
