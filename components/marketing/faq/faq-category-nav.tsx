"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { FaqCategoryKey } from "@/lib/marketing/faq";

type Category = {
  key: FaqCategoryKey;
  label: string;
};

type FaqCategoryNavProps = {
  categories: readonly Category[];
  ariaLabel: string;
};

export function FaqCategoryNav({ categories, ariaLabel }: FaqCategoryNavProps) {
  const [active, setActive] = useState<FaqCategoryKey>(categories[0]!.key);

  useEffect(() => {
    const nodes = categories
      .map((c) => document.getElementById(c.key))
      .filter((n): n is HTMLElement => Boolean(n));

    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        const first = visible[0]?.target.id as FaqCategoryKey | undefined;
        if (first) setActive(first);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.01 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [categories]);

  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-16 z-20 -mx-6 mb-12 border-b border-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)] bg-[color-mix(in_oklab,var(--marketing-wash)_92%,transparent)] px-6 backdrop-blur-md md:-mx-8 md:mb-16 md:px-8"
    >
      <ul className="flex gap-2 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const isActive = active === category.key;
          return (
            <li key={category.key} className="shrink-0">
              <a
                href={`#${category.key}`}
                onClick={() => setActive(category.key)}
                className={cn(
                  "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-[var(--marketing-ink)] text-white"
                    : "bg-[var(--marketing-surface)] text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)] hover:bg-[var(--marketing-mist)] hover:text-[var(--marketing-ink)]",
                )}
              >
                {category.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
