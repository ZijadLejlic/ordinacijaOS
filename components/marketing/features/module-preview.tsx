import { getTranslations } from "next-intl/server";
import { BrowserFrame } from "@/components/marketing/browser-frame";

type ModulePreviewProps = {
  moduleKey: string;
};

export async function ModulePreview({ moduleKey }: ModulePreviewProps) {
  const t = await getTranslations("Marketing.features");

  return (
    <BrowserFrame url={t("browserUrl")} className="w-full">
      <div className="p-3 md:p-5">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] md:p-4">
          <p className="text-xs font-medium text-[var(--marketing-ink)] md:text-sm">
            {t(`modules.${moduleKey}.preview.title`)}
          </p>
          <ul className="mt-3 space-y-2">
            {(["row1", "row2", "row3"] as const).map((row, index) => (
              <li
                key={row}
                className="flex items-center gap-3 rounded-lg bg-[var(--marketing-wash)] px-2.5 py-2"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background:
                      index === 0
                        ? "var(--marketing-accent)"
                        : index === 1
                          ? "var(--marketing-cyan)"
                          : "var(--marketing-deep)",
                  }}
                  aria-hidden
                />
                <span className="truncate text-xs text-[var(--marketing-ink)] md:text-sm">
                  {t(`modules.${moduleKey}.preview.${row}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BrowserFrame>
  );
}
