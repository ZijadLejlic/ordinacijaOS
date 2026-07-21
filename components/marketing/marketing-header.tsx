"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MenuIcon, XIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import { MARKETING_NAV_LINKS } from "@/components/marketing/marketing-nav";
import { cn } from "@/lib/utils";

type MarketingHeaderProps = {
  /** W11 — Blog in navbar only when ≥ 2 published posts. */
  showBlogNav?: boolean;
};

export function MarketingHeader({ showBlogNav = false }: MarketingHeaderProps) {
  const t = useTranslations("Marketing.nav");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const navLinks = showBlogNav
    ? [
        ...MARKETING_NAV_LINKS.slice(0, 4),
        { href: "/blog" as const, labelKey: "blog" as const },
        ...MARKETING_NAV_LINKS.slice(4),
      ]
    : MARKETING_NAV_LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled
          ? "border-[var(--marketing-mist)] bg-white/90 backdrop-blur-md"
          : "border-transparent bg-white",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-6 md:px-8">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2.5 text-[var(--marketing-ink)]"
        >
          <BrandLogo
            variant="full"
            priority
            className="h-8 w-auto max-w-[9.5rem]"
          />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)] transition-colors hover:bg-[var(--marketing-wash)] hover:text-[var(--marketing-ink)]"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <LocaleSwitcher />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-[var(--marketing-ink)]",
            )}
          >
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonVariants(),
              "rounded-[10px] bg-[var(--marketing-accent)] text-white hover:bg-[var(--marketing-deep)]",
            )}
          >
            {t("signup")}
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex size-10 items-center justify-center rounded-lg text-[var(--marketing-ink)] hover:bg-[var(--marketing-wash)] lg:hidden"
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {open ? (
        <div
          id="marketing-mobile-nav"
          className="fixed inset-0 top-16 z-40 bg-white lg:hidden"
        >
          <nav className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-[1200px] flex-col px-6 pb-8 pt-4">
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-[var(--marketing-ink)] hover:bg-[var(--marketing-wash)]"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-[var(--marketing-mist)] pt-4">
              <LocaleSwitcher className="w-fit" />
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 w-full rounded-[10px] border-[color-mix(in_oklab,var(--marketing-ink)_18%,transparent)] text-[var(--marketing-ink)]",
                )}
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 w-full rounded-[10px] bg-[var(--marketing-accent)] text-white hover:bg-[var(--marketing-deep)]",
                )}
              >
                {t("signup")}
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
