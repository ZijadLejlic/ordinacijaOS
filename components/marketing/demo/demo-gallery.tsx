"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { TourPreview } from "@/components/marketing/tour/tour-preview";
import {
  DEMO_GALLERY_KEYS,
  type DemoGalleryKey,
  type TourPreviewKind,
} from "@/lib/marketing/tour";

const GALLERY_PREVIEW: Record<DemoGalleryKey, TourPreviewKind> = {
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
                className="group w-full text-left transition-transform duration-150 hover:-translate-y-[3px]"
              >
                <BrowserFrame url={t("browserUrl")} className="w-full">
                  <TourPreview
                    kind={GALLERY_PREVIEW[key]}
                    title={t(`gallery.items.${key}.title`)}
                    rows={[
                      t(`gallery.items.${key}.row1`),
                      t(`gallery.items.${key}.row2`),
                      t(`gallery.items.${key}.row3`),
                    ]}
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
              <TourPreview
                kind={GALLERY_PREVIEW[open]}
                title={t(`gallery.items.${open}.title`)}
                rows={[
                  t(`gallery.items.${open}.row1`),
                  t(`gallery.items.${open}.row2`),
                  t(`gallery.items.${open}.row3`),
                ]}
                annotations={2}
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
