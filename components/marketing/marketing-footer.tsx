import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PRODUCT_NAME } from "@/lib/brand/constants";

export async function MarketingFooter() {
  const t = await getTranslations("Marketing");

  return (
    <footer className="mt-auto border-t border-[color-mix(in_oklab,var(--marketing-ink)_12%,transparent)] px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <BrandLogo variant="mark" className="h-7 w-7" />
          <p className="text-sm text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]">
            © {new Date().getFullYear()} {PRODUCT_NAME}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/pricing"
            className="text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)] underline-offset-4 hover:underline"
          >
            {t("nav.pricing")}
          </Link>
          <span className="text-[color-mix(in_oklab,var(--marketing-ink)_45%,transparent)]">
            {t("footer.legalSoon")}
          </span>
        </div>
      </div>
    </footer>
  );
}
