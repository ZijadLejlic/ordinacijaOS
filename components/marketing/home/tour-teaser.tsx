import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function TourTeaser() {
  const t = await getTranslations("Marketing.home.tour");
  const tHero = await getTranslations("Marketing.home.hero");

  return (
    <SectionShell tone="mist" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <ol className="space-y-4">
            {(["1", "2", "3"] as const).map((step) => (
              <li key={step} className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-accent)] text-sm font-semibold text-white">
                  {step}
                </span>
                <p className="pt-1.5 text-base text-[var(--marketing-ink)] md:text-[17px]">
                  {t(`steps.${step}`)}
                </p>
              </li>
            ))}
          </ol>
          <Link
            href="/tour"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 h-11 rounded-[10px] bg-[var(--marketing-accent)] px-5 text-white hover:bg-[var(--marketing-deep)]",
            )}
          >
            {t("cta")}
            <span aria-hidden className="ml-1">
              →
            </span>
          </Link>
        </Reveal>

        <Reveal delayMs={90}>
          <div className="relative mx-auto h-[280px] w-full max-w-md md:h-[320px]">
            <div className="absolute top-0 left-6 w-[78%] rotate-[-4deg] opacity-70">
              <BrowserFrame url={tHero("browserUrl")}>
                <div className="h-28 bg-gradient-to-br from-[var(--marketing-mist)] to-white p-3 md:h-32" />
              </BrowserFrame>
            </div>
            <div className="absolute top-8 right-2 w-[78%] rotate-[3deg] opacity-85">
              <BrowserFrame url={tHero("browserUrl")}>
                <div className="h-28 bg-gradient-to-br from-white to-[var(--marketing-wash)] p-3 md:h-32" />
              </BrowserFrame>
            </div>
            <div className="absolute right-8 bottom-0 w-[82%]">
              <BrowserFrame url={tHero("browserUrl")}>
                <div className="space-y-2 p-3 md:p-4">
                  <div className="h-3 w-1/3 rounded bg-[var(--marketing-mist)]" />
                  <div className="h-16 rounded-lg bg-white ring-1 ring-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)]" />
                  <div className="h-10 rounded-lg bg-[var(--marketing-wash)]" />
                </div>
              </BrowserFrame>
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
