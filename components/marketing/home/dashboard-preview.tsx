import { getTranslations } from "next-intl/server";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { MarketingShot } from "@/components/marketing/marketing-shot";
import { cn } from "@/lib/utils";

export async function DashboardPreview() {
  const t = await getTranslations("Marketing.home.hero");

  return (
    <>
      {/* Phone shot — small asset, eager but not fetchPriority high (H1 stays LCP). */}
      <div className="mx-auto w-full max-w-[200px] sm:max-w-[220px] lg:hidden">
        <div
          className={cn(
            "overflow-hidden rounded-[1.75rem] border border-[var(--marketing-mist)] bg-white p-1.5",
            "shadow-[0_25px_60px_-15px_rgb(15_27_61_/_0.25)]",
          )}
        >
          <div className="overflow-hidden rounded-[1.35rem] bg-[var(--marketing-wash)]">
            <MarketingShot
              id="mobile-calendar"
              alt={t("phoneScreenshotAlt")}
              phone
              eager
              sizes="220px"
            />
          </div>
        </div>
      </div>

      {/* Desktop browser shot — preload is media-gated in HomeHero; lazy here so
          mobile does not download the 1440px asset while this node is display:none. */}
      <div className="hidden lg:block">
        <BrowserFrame url={t("browserUrl")} className="w-full">
          <MarketingShot
            id="dashboard"
            alt={t("screenshotAlt")}
            sizes="720px"
            className="rounded-b-xl"
            desktopLcp
          />
        </BrowserFrame>
      </div>
    </>
  );
}
