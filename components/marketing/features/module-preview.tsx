import { getTranslations } from "next-intl/server";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { MarketingShot } from "@/components/marketing/marketing-shot";
import type { MarketingShotId } from "@/lib/marketing/screenshots";

const MODULE_SHOT: Record<string, MarketingShotId> = {
  karton: "chart",
  odontogram: "odontogram",
  planTerapije: "plan",
  kalendar: "calendar",
  finansije: "invoice",
  podsjetnici: "reminder",
  dokumenti: "chart",
  inventar: "inventory",
  tim: "settings",
  branding: "invoice",
};

type ModulePreviewProps = {
  moduleKey: string;
};

export async function ModulePreview({ moduleKey }: ModulePreviewProps) {
  const t = await getTranslations("Marketing.features");
  const shotId = MODULE_SHOT[moduleKey] ?? "dashboard";

  return (
    <BrowserFrame url={t("browserUrl")} className="w-full">
      <MarketingShot
        id={shotId}
        alt={t(`modules.${moduleKey}.preview.title`)}
      />
    </BrowserFrame>
  );
}
