"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { trackEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

export type FaqAccordionItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: readonly FaqAccordionItem[];
  /** PostHog `faq_opened` source (e.g. home, faq, pricing). */
  source?: string;
  className?: string;
};

export function FaqAccordion({ items, source, className }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) {
      trackEvent("faq_opened", {
        question_id: id,
        ...(source ? { source } : {}),
      });
    }
  }

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item, index) => {
        const open = openId === item.id;
        const n = String(index + 1).padStart(2, "0");

        return (
          <li key={item.id}>
            <div
              className={cn(
                "rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200",
                open
                  ? "border-[color-mix(in_oklab,var(--marketing-accent)_28%,transparent)] bg-[var(--marketing-mist)] shadow-[0_18px_40px_-28px_rgb(11_110_245_/_0.55)]"
                  : "border-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] bg-[color-mix(in_oklab,var(--marketing-mist)_55%,var(--marketing-surface))] hover:border-[color-mix(in_oklab,var(--marketing-accent)_18%,transparent)] hover:bg-[var(--marketing-mist)]",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`faq-panel-${item.id}`}
                id={`faq-trigger-${item.id}`}
                onClick={() => toggle(item.id)}
                className="flex w-full items-start gap-4 px-5 py-4 text-left md:gap-5 md:px-6 md:py-5"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 font-mono text-[12px] font-medium tracking-wider tabular-nums transition-colors",
                    open
                      ? "text-[var(--marketing-accent)]"
                      : "text-[color-mix(in_oklab,var(--marketing-ink)_35%,transparent)]",
                  )}
                >
                  {n}
                </span>
                <span className="min-w-0 flex-1 font-[family-name:var(--font-marketing-display)] text-[1.05rem] leading-snug font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-lg md:leading-snug">
                  {item.question}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200",
                    open
                      ? "bg-[var(--marketing-accent)] text-white"
                      : "bg-[var(--marketing-mist)] text-[var(--marketing-accent)]",
                  )}
                >
                  {open ? (
                    <MinusIcon className="size-4" strokeWidth={2.25} />
                  ) : (
                    <PlusIcon className="size-4" strokeWidth={2.25} />
                  )}
                </span>
              </button>

              <div
                id={`faq-panel-${item.id}`}
                role="region"
                aria-labelledby={`faq-trigger-${item.id}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <p
                    className={cn(
                      "px-5 pb-5 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)] md:px-6 md:pb-6 md:pl-[4.25rem] md:text-[17px] md:leading-[1.65]",
                      "motion-safe:transition-opacity motion-safe:duration-300",
                      open ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
