import {
  EuroIcon,
  GlobeIcon,
  LifeBuoyIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const ITEMS = [
  { key: "language", Icon: GlobeIcon },
  { key: "currency", Icon: EuroIcon },
  { key: "phone", Icon: PhoneIcon },
  { key: "timezone", Icon: MapPinIcon },
  { key: "support", Icon: LifeBuoyIcon },
] as const;

export async function RegionSection() {
  const t = await getTranslations("Marketing.whyDentord.region");

  return (
    <SectionShell
      tone="white"
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ key, Icon }, index) => (
          <Reveal key={key} delayMs={index * 60}>
            <article className="h-full rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-wash)] p-5 transition-transform duration-150 hover:-translate-y-[3px]">
              <span className="inline-flex size-12 items-center justify-center rounded-[12px] bg-[var(--marketing-mist)] text-[var(--marketing-accent)]">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)]">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)] md:text-[15px]">
                {t(`items.${key}.body`)}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
