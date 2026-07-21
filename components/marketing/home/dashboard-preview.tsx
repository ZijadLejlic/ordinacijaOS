import { getTranslations } from "next-intl/server";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { MarketingShot } from "@/components/marketing/marketing-shot";

export async function DashboardPreview() {
  const t = await getTranslations("Marketing.home.hero");

  return (
    <BrowserFrame url={t("browserUrl")} className="w-full">
      {/* No priority: parent is `hidden lg:block` — high fetchPriority still
          downloads on mobile and steals LCP bandwidth under Slow 4G. */}
      <MarketingShot
        id="dashboard"
        alt={t("screenshotAlt")}
        className="rounded-b-xl"
      />
    </BrowserFrame>
  );
}
