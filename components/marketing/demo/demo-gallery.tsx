"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { MarketingShot } from "@/components/marketing/marketing-shot";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import {
  DEMO_GALLERY_KEYS,
  type DemoGalleryKey,
} from "@/lib/marketing/tour";
import {
  marketingShotSrc,
  type MarketingShotId,
} from "@/lib/marketing/screenshots";

const GALLERY_SHOT: Record<DemoGalleryKey, MarketingShotId> = {
  dashboard: "dashboard",
  patients: "patients",
  odontogram: "odontogram",
  calendar: "calendar",
  invoice: "invoice",
  crm: "crm",
  inventory: "inventory",
  settings: "settings",
};

export function DemoGallery() {
  const t = useTranslations("Marketing.demo");
  const [open, setOpen] = useState<DemoGalleryKey | null>(null);

  return (
    <>
      <SectionShell
        tone="white"
        eyebrow={t("gallery.eyebrow")}
        title={t("gallery.title")}
        description={t("gallery.description")}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_GALLERY_KEYS.map((key, index) => (
            <Reveal key={key} delayMs={index * 60}>
              <button
                type="button"
                onClick={() => setOpen(key)}
                className="group w-full text-left transition-transform duration-150 hover:-translate-y-[3px] motion-reduce:hover:translate-y-0"
              >
                <BrowserFrame url={t("browserUrl")} className="w-full">
                  <MarketingShot
                    id={GALLERY_SHOT[key]}
                    alt={t(`gallery.items.${key}.title`)}
                  />
                </BrowserFrame>
                <p className="mt-3 font-medium text-[var(--marketing-ink)]">
                  {t(`gallery.items.${key}.title`)}
                </p>
                <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]">
                  {t(`gallery.items.${key}.caption`)}
                </p>
              </button>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 grid items-end justify-items-center gap-8 sm:grid-cols-2">
          <figure className="w-full max-w-[280px]">
            <MarketingShot
              id="mobile-calendar"
              alt={t("gallery.mobile.calendarAlt")}
              phone
            />
            <figcaption className="mt-3 text-center text-sm text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]">
              {t("gallery.mobile.calendar")}
            </figcaption>
          </figure>
          <figure className="w-full max-w-[280px]">
            <MarketingShot
              id="mobile-chart"
              alt={t("gallery.mobile.chartAlt")}
              phone
            />
            <figcaption className="mt-3 text-center text-sm text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)]">
              {t("gallery.mobile.chart")}
            </figcaption>
          </figure>
        </div>
      </SectionShell>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(`gallery.items.${open}.title`)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(15_27_61_/_0.55)] p-4"
          onClick={() => setOpen(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(null);
          }}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="absolute -top-10 right-0 rounded-full bg-white/90 p-2 text-[var(--marketing-ink)]"
              aria-label={t("gallery.close")}
            >
              <X className="size-5" strokeWidth={2} />
            </button>
            <BrowserFrame url={t("browserUrl")}>
              <Image
                src={marketingShotSrc(GALLERY_SHOT[open])}
                alt={t(`gallery.items.${open}.title`)}
                width={1200}
                height={720}
                className="h-auto w-full"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </BrowserFrame>
            <p className="mt-3 text-center text-sm text-white/90">
              {t(`gallery.items.${open}.caption`)}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
