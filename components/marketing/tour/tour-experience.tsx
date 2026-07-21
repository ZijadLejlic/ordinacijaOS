"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { MarketingShot } from "@/components/marketing/marketing-shot";
import { trackEvent } from "@/lib/analytics/posthog";
import { TOUR_CHAPTERS, type TourChapterId } from "@/lib/marketing/tour";
import { TOUR_PREVIEW_TO_SHOT } from "@/lib/marketing/screenshots";
import { cn } from "@/lib/utils";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type FlatStep = {
  chapterId: TourChapterId;
  stepId: string;
  preview: (typeof TOUR_CHAPTERS)[number]["steps"][number]["preview"];
  annotations?: number;
};

const FLAT_STEPS: FlatStep[] = TOUR_CHAPTERS.flatMap((chapter) =>
  chapter.steps.map((step) => ({
    chapterId: chapter.id,
    stepId: step.id,
    preview: step.preview,
    annotations: step.annotations,
  })),
);

export function TourExperience() {
  const t = useTranslations("Marketing.tour");
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  const [activeStepId, setActiveStepId] = useState(FLAT_STEPS[0]!.stepId);
  const [activeChapterId, setActiveChapterId] = useState<TourChapterId>(
    TOUR_CHAPTERS[0]!.id,
  );
  const seenChapters = useRef(new Set<string>());

  useEffect(() => {
    const nodes = FLAT_STEPS.map((s) =>
      document.getElementById(`tour-step-${s.stepId}`),
    ).filter(Boolean) as HTMLElement[];

    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top?.target.id) return;
        const stepId = top.target.id.replace("tour-step-", "");
        const step = FLAT_STEPS.find((s) => s.stepId === stepId);
        if (!step) return;
        setActiveStepId(step.stepId);
        setActiveChapterId(step.chapterId);
        if (!seenChapters.current.has(step.chapterId)) {
          seenChapters.current.add(step.chapterId);
          trackEvent("tour_chapter_viewed", { chapter: step.chapterId });
        }
      },
      { rootMargin: "-30% 0px -45% 0px", threshold: [0.2, 0.4, 0.6] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const activeStep =
    FLAT_STEPS.find((s) => s.stepId === activeStepId) ?? FLAT_STEPS[0]!;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
      {/* Chapter mini-nav */}
      <nav
        aria-label={t("chapterNavLabel")}
        className="sticky top-16 z-20 -mx-6 mb-8 border-b border-[var(--marketing-mist)] bg-[color-mix(in_oklab,var(--marketing-surface)_92%,transparent)] px-6 py-3 backdrop-blur-md md:-mx-8 md:px-8"
      >
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {TOUR_CHAPTERS.map((chapter, index) => (
            <li key={chapter.id}>
              <a
                href={`#tour-chapter-${chapter.id}`}
                className={cn(
                  "inline-flex whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm transition-colors",
                  activeChapterId === chapter.id
                    ? "bg-[var(--marketing-mist)] font-medium text-[var(--marketing-accent)]"
                    : "text-[color-mix(in_oklab,var(--marketing-ink)_65%,transparent)] hover:bg-[var(--marketing-wash)]",
                )}
              >
                <span className="mr-1.5 tabular-nums opacity-60">
                  {index + 1}.
                </span>
                {t(`chapters.${chapter.id}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:gap-12">
        {/* Steps column */}
        <div className="relative min-w-0">
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-[11px] w-px bg-[var(--marketing-mist)] md:left-[15px]"
          />
          <div className="space-y-16 md:space-y-24">
            {TOUR_CHAPTERS.map((chapter) => (
              <section
                key={chapter.id}
                id={`tour-chapter-${chapter.id}`}
                className="scroll-mt-36"
              >
                <div className="mb-8 flex flex-wrap items-center gap-3 pl-8 md:pl-10">
                  <h2 className="font-[family-name:var(--font-marketing-display)] text-2xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[1.75rem]">
                    {t(`chapters.${chapter.id}.title`)}
                  </h2>
                  <span className="rounded-full bg-[var(--marketing-mist)] px-2.5 py-0.5 text-xs font-medium text-[var(--marketing-accent)]">
                    {t("minutesBadge", { minutes: chapter.minutes })}
                  </span>
                </div>

                <ol className="space-y-12 md:space-y-16">
                  {chapter.steps.map((step, stepIndex) => {
                    const isActive = activeStepId === step.id;
                    return (
                      <li
                        key={step.id}
                        id={`tour-step-${step.id}`}
                        className="relative scroll-mt-40 pl-8 md:pl-10"
                      >
                        <span
                          className={cn(
                            "absolute top-1 left-0 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold md:size-8 md:text-xs",
                            isActive
                              ? "border-[var(--marketing-accent)] bg-[var(--marketing-accent)] text-white"
                              : "border-[var(--marketing-mist)] bg-white text-[var(--marketing-ink)]",
                          )}
                        >
                          {stepIndex + 1}
                        </span>
                        <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
                          {t(`chapters.${chapter.id}.eyebrow`)}
                        </p>
                        <h3 className="mt-2 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
                          {t(`steps.${step.id}.title`)}
                        </h3>
                        <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
                          {t(`steps.${step.id}.body`)}
                        </p>
                        {step.annotations ? (
                          <ul className="mt-4 space-y-2">
                            {Array.from(
                              { length: step.annotations },
                              (_, i) => i + 1,
                            ).map((n) => (
                              <li
                                key={n}
                                className="flex items-start gap-2 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_78%,transparent)]"
                              >
                                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-mist)] text-[10px] font-semibold text-[var(--marketing-accent)]">
                                  {n}
                                </span>
                                {t(`steps.${step.id}.a${n}`)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-4 flex items-start gap-2 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_78%,transparent)]">
                            <Check
                              className="mt-0.5 size-4 shrink-0 text-[var(--marketing-accent)]"
                              strokeWidth={2}
                              aria-hidden
                            />
                            {t(`steps.${step.id}.note`)}
                          </p>
                        )}

                        {/* Mobile preview (linear) */}
                        <div className="mt-6 lg:hidden">
                          <BrowserFrame url={t("browserUrl")}>
                            <MarketingShot
                              id={TOUR_PREVIEW_TO_SHOT[step.preview]}
                              alt={t(`previews.${step.preview}.title`)}
                            />
                          </BrowserFrame>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>

        {/* Sticky desktop preview */}
        <div className="relative hidden min-w-0 lg:block">
          <div className="sticky top-36">
            <BrowserFrame url={t("browserUrl")} className="w-full">
              <div
                className={cn(
                  reduceMotion ? "" : "transition-opacity duration-500 ease-out",
                )}
                key={activeStep.stepId}
              >
                <MarketingShot
                  id={TOUR_PREVIEW_TO_SHOT[activeStep.preview]}
                  alt={t(`previews.${activeStep.preview}.title`)}
                  priority={activeStep.stepId === FLAT_STEPS[0]!.stepId}
                />
              </div>
            </BrowserFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
