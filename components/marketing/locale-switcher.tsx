"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const t = useTranslations("Locale");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  return (
    <Select
      value={locale}
      onValueChange={(next) => {
        if (!next || next === locale) return;
        router.replace(
          // Dynamic routes need params when switching locale (next-intl).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { pathname, params } as any,
          { locale: next as AppLocale },
        );
      }}
    >
      <SelectTrigger
        aria-label={t("label")}
        className={cn(
          "h-9 min-h-9 min-w-[8.5rem] gap-1 rounded-lg border px-2.5 text-xs font-medium shadow-none",
          "focus-visible:ring-2 focus-visible:ring-offset-0",
          tone === "dark"
            ? "border-white/20 bg-transparent text-white hover:bg-white/10 focus-visible:border-white/40 focus-visible:ring-white/30 data-placeholder:text-white/70 [&_svg]:text-white/70"
            : "border-[color-mix(in_oklab,var(--marketing-ink)_14%,transparent)] bg-transparent text-[var(--marketing-ink)] hover:bg-[var(--marketing-wash)] focus-visible:border-[var(--marketing-accent)] focus-visible:ring-[color-mix(in_oklab,var(--marketing-accent)_35%,transparent)] data-placeholder:text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)] [&_svg]:text-[color-mix(in_oklab,var(--marketing-ink)_55%,transparent)]",
          className,
        )}
      >
        <SelectValue>{t(locale)}</SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        sideOffset={6}
        alignItemWithTrigger={false}
        className={cn(
          "min-w-[10.5rem] rounded-xl p-1 shadow-lg ring-1",
          tone === "dark"
            ? "bg-[var(--marketing-ink)] text-white ring-white/15"
            : "bg-white text-[var(--marketing-ink)] ring-[color-mix(in_oklab,var(--marketing-ink)_10%,transparent)]",
        )}
      >
        {routing.locales.map((code) => (
          <SelectItem
            key={code}
            value={code}
            className={cn(
              "min-h-10 cursor-pointer rounded-lg px-3 py-2 text-sm",
              tone === "dark"
                ? "focus:bg-white/12 focus:text-white data-highlighted:bg-white/12"
                : "focus:bg-[var(--marketing-wash)] focus:text-[var(--marketing-ink)]",
            )}
          >
            {t(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
