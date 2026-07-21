"use client";

import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type LocaleSwitcherProps = {
  className?: string;
  tone?: "light" | "dark";
};

export function LocaleSwitcher({
  className,
  tone = "light",
}: LocaleSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border p-0.5 text-xs font-medium",
        tone === "dark"
          ? "border-white/20 text-white/70"
          : "border-[color-mix(in_oklab,var(--marketing-ink)_14%,transparent)] text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => {
              if (code !== locale) {
                router.replace(
                  // Dynamic routes need params when switching locale (next-intl).
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  { pathname, params } as any,
                  { locale: code },
                );
              }
            }}
            className={cn(
              "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2.5 uppercase transition-colors",
              active
                ? tone === "dark"
                  ? "bg-white/15 text-white"
                  : "bg-[var(--marketing-mist)] text-[var(--marketing-ink)]"
                : tone === "dark"
                  ? "hover:text-white"
                  : "hover:text-[var(--marketing-ink)]",
            )}
            aria-pressed={active}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
