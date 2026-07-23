import { setRequestLocale } from "next-intl/server";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { CookieConsentBanner } from "@/components/analytics/cookie-consent-banner";
import { shouldShowBlogInNav } from "@/lib/blog/posts";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const showBlogNav = shouldShowBlogInNav(locale as AppLocale);

  return (
    <div className="marketing-shell flex min-h-full flex-1 flex-col">
      <MarketingHeader showBlogNav={showBlogNav} />
      <div className="flex flex-1 flex-col">{children}</div>
      <MarketingFooter />
      <CookieConsentBanner />
    </div>
  );
}
