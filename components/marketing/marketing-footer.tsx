import { getTranslations } from "next-intl/server";
import { ServerIcon, ShieldCheckIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import {
  MARKETING_FOOTER_COMPANY,
  MARKETING_FOOTER_LEGAL,
  MARKETING_FOOTER_PRODUCT,
} from "@/components/marketing/marketing-nav";
import {
  EMAIL_SUPPORT,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "@/lib/brand/constants";

export async function MarketingFooter() {
  const t = await getTranslations("Marketing");

  return (
    <footer className="mt-auto bg-[var(--marketing-ink)] text-white">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-14 md:grid-cols-2 md:px-8 lg:grid-cols-4 lg:gap-8">
        <div className="space-y-4 lg:pr-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandLogo variant="mark" className="h-8 w-8 brightness-0 invert" />
            <span className="text-lg font-semibold tracking-tight">
              {PRODUCT_NAME}
            </span>
          </Link>
          <p className="text-sm font-medium text-white/90">{PRODUCT_TAGLINE}</p>
          <p className="max-w-xs text-sm leading-relaxed text-white/65">
            {t("footer.blurb")}
          </p>
        </div>

        <FooterColumn title={t("footer.product")}>
          {MARKETING_FOOTER_PRODUCT.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {t(`nav.${item.labelKey}`)}
            </Link>
          ))}
        </FooterColumn>

        <FooterColumn title={t("footer.company")}>
          {MARKETING_FOOTER_COMPANY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {t(`nav.${item.labelKey}`)}
            </Link>
          ))}
        </FooterColumn>

        <FooterColumn title={t("footer.legal")}>
          {MARKETING_FOOTER_LEGAL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {t(`nav.${item.labelKey}`)}
            </Link>
          ))}
        </FooterColumn>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/55">
            <span>
              © {new Date().getFullYear()} {PRODUCT_NAME}
            </span>
            <a
              href={`mailto:${EMAIL_SUPPORT}`}
              className="transition-colors hover:text-white"
            >
              {EMAIL_SUPPORT}
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/75">
              <ShieldCheckIcon className="size-3.5 text-[var(--marketing-cyan)]" />
              GDPR
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/75">
              <ServerIcon className="size-3.5 text-[var(--marketing-cyan)]" />
              EU hosting
            </span>
            <LocaleSwitcher tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-4 text-sm font-semibold text-white">{title}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
