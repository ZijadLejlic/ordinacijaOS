import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { MarketingShot } from "@/components/marketing/marketing-shot";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { buttonVariants } from "@/components/ui/button";
import type { MarketingShotId } from "@/lib/marketing/screenshots";
import { cn } from "@/lib/utils";

/** Matches the three Brzi-start steps: register → services/team → first appointment. */
const STACK: { id: MarketingShotId; rotate: string; className: string }[] = [
  {
    id: "signup",
    rotate: "rotate-[-5deg]",
    className: "top-0 left-3 z-0 w-[76%] opacity-75",
  },
  {
    id: "onboarding-2",
    rotate: "rotate-[3.5deg]",
    className: "top-7 right-1 z-10 w-[76%] opacity-90",
  },
  {
    id: "calendar",
    rotate: "rotate-[-1deg]",
    className: "right-6 bottom-0 z-20 w-[82%]",
  },
];

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
          <div
            className="relative mx-auto h-[300px] w-full max-w-md md:h-[360px]"
            aria-hidden
          >
            {STACK.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "absolute shadow-[0_18px_40px_-18px_rgb(15_27_61_/_0.45)]",
                  card.className,
                  card.rotate,
                )}
              >
                <BrowserFrame url={tHero("browserUrl")}>
                  <div className="h-[7.25rem] overflow-hidden md:h-[8.5rem]">
                    <MarketingShot
                      id={card.id}
                      alt=""
                      className="origin-top scale-[1.15]"
                    />
                  </div>
                </BrowserFrame>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
