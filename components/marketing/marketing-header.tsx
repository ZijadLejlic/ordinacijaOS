import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function MarketingHeader() {
  const t = await getTranslations("Marketing");

  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 md:px-10">
      <Link
        href="/"
        className="font-[family-name:var(--font-marketing-display)] text-lg tracking-tight text-[var(--marketing-ink)]"
      >
        OrdinacijaOS
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-[var(--marketing-ink)]",
          )}
        >
          {t("nav.pricing")}
        </Link>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-[var(--marketing-ink)]",
          )}
        >
          {t("nav.login")}
        </Link>
        <Link href="/signup" className={cn(buttonVariants())}>
          {t("nav.signup")}
        </Link>
      </nav>
    </header>
  );
}
