"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InstallStepIllustration } from "@/components/marketing/install/install-illustrations";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import {
  INSTALL_PLATFORMS,
  INSTALL_STEP_COUNTS,
  type InstallPlatform,
} from "@/lib/marketing/install";
import { cn } from "@/lib/utils";

export function InstallPlatforms() {
  const t = useTranslations("Marketing.install");
  const [platform, setPlatform] = useState<InstallPlatform>("android");
  const stepCount = INSTALL_STEP_COUNTS[platform];

  return (
    <SectionShell
      tone="wash"
      className="pt-4 md:pt-6"
      eyebrow={t("platformsEyebrow")}
      title={t("platformsTitle")}
      description={t("platformsDescription")}
    >
      <Reveal>
        <div
          role="tablist"
          aria-label={t("platformsAria")}
          className="flex flex-wrap gap-2"
        >
          {INSTALL_PLATFORMS.map((key) => {
            const selected = platform === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`install-tab-${key}`}
                aria-controls={`install-panel-${key}`}
                onClick={() => setPlatform(key)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-[var(--marketing-accent)] text-white shadow-[0_12px_28px_-16px_rgb(11_110_245_/_0.7)]"
                    : "bg-white text-[var(--marketing-ink)] ring-1 ring-[color-mix(in_oklab,var(--marketing-ink)_10%,transparent)] hover:bg-[var(--marketing-mist)]",
                )}
              >
                {t(`platforms.${key}.label`)}
              </button>
            );
          })}
        </div>
      </Reveal>

      <div
        id={`install-panel-${platform}`}
        role="tabpanel"
        aria-labelledby={`install-tab-${platform}`}
        className="mt-10"
      >
        <p className="mb-8 max-w-2xl text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)]">
          {t(`platforms.${platform}.intro`)}
        </p>

        <ol className="flex flex-col gap-10 md:gap-12">
          {Array.from({ length: stepCount }, (_, i) => {
            const step = i + 1;
            const title = t(`platforms.${platform}.steps.step${step}.title`);
            const body = t(`platforms.${platform}.steps.step${step}.body`);
            const caption = t(
              `platforms.${platform}.steps.step${step}.caption`,
            );

            return (
              <li key={step}>
                <Reveal delayMs={i * 40}>
                  <div className="grid items-start gap-6 md:grid-cols-2 md:gap-10">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-[13px] font-semibold tracking-wider text-[var(--marketing-accent)]">
                          {String(step).padStart(2, "0")}
                        </span>
                        <h3 className="font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
                          {title}
                        </h3>
                      </div>
                      <p className="mt-3 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)] md:text-[17px]">
                        {body}
                      </p>
                    </div>
                    <InstallStepIllustration
                      platform={platform}
                      step={step}
                      caption={caption}
                    />
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </SectionShell>
  );
}
