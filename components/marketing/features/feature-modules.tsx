import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ModulePreview } from "@/components/marketing/features/module-preview";
import { Reveal } from "@/components/marketing/reveal";
import { isProfessionalFeature } from "@/lib/marketing/plans";
import type { FeatureKey } from "@/lib/entitlements/features";
import { cn } from "@/lib/utils";

/**
 * Modules + optional plan-gate key for “Pro” badge (PRD §4.3 matrix).
 * Badge only when Starter=no and Professional=yes — never hardcode deviations.
 */
const MODULES = [
  { key: "karton", anchor: "karton", gate: null },
  { key: "odontogram", anchor: "odontogram", gate: null },
  { key: "planTerapije", anchor: "plan-terapije", gate: null },
  { key: "kalendar", anchor: "kalendar", gate: "waitlist_auto" },
  {
    key: "finansije",
    anchor: "finansije",
    gate: "expenses_reports_excel",
  },
  { key: "podsjetnici", anchor: "podsjetnici", gate: "crm_light" },
  { key: "dokumenti", anchor: "dokumenti", gate: "consent_draw_sign" },
  { key: "inventar", anchor: "inventar", gate: "inventory_basic" },
  { key: "tim", anchor: "tim", gate: null },
  { key: "branding", anchor: "branding", gate: "branding_custom" },
] as const satisfies ReadonlyArray<{
  key: string;
  anchor: string;
  gate: FeatureKey | null;
}>;

function showProBadge(gate: FeatureKey | null): boolean {
  if (!gate) return false;
  return isProfessionalFeature(gate);
}

export async function FeatureModules() {
  const t = await getTranslations("Marketing.features");

  return (
    <>
      {MODULES.map(({ key, anchor, gate }, index) => {
        const textFirst = index % 2 === 0;
        const tone = index % 2 === 0 ? "white" : "wash";
        const pro = showProBadge(gate);

        return (
          <section
            key={key}
            id={anchor}
            className={cn(
              "scroll-mt-24 py-16 md:scroll-mt-28 md:py-24 lg:py-28",
              tone === "white"
                ? "bg-[var(--marketing-surface)]"
                : "bg-[var(--marketing-wash)]",
            )}
          >
            <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-6 md:gap-12 md:px-8 lg:grid-cols-2 lg:gap-16">
              <Reveal
                className={cn(textFirst ? "lg:order-1" : "lg:order-2")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
                    {t(`modules.${key}.eyebrow`)}
                  </p>
                  {pro ? (
                    <span className="rounded-md bg-[var(--marketing-mist)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--marketing-deep)] uppercase">
                      {t("proBadge")}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 max-w-[28ch] font-[family-name:var(--font-marketing-display)] text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[2.25rem]">
                  {t(`modules.${key}.title`)}
                </h2>
                <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_78%,transparent)] md:text-[17px] md:leading-[1.65]">
                  {t(`modules.${key}.body`)}
                </p>
                <ul className="mt-6 space-y-3">
                  {(["1", "2", "3"] as const).map((n) => (
                    <li
                      key={n}
                      className="flex items-start gap-3 text-base text-[var(--marketing-ink)]"
                    >
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-mist)] text-[var(--marketing-accent)]">
                        <CheckIcon className="size-3.5" strokeWidth={2.5} />
                      </span>
                      <span className="leading-snug text-[color-mix(in_oklab,var(--marketing-ink)_85%,transparent)]">
                        {t(`modules.${key}.bullets.${n}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal
                className={cn(
                  "min-w-0",
                  textFirst ? "lg:order-2" : "lg:order-1",
                )}
                delayMs={80}
              >
                <ModulePreview moduleKey={key} />
              </Reveal>
            </div>
          </section>
        );
      })}
    </>
  );
}
