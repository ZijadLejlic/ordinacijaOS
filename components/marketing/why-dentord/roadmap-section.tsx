import {
  BotIcon,
  HeartHandshakeIcon,
  MessageSquareIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const ITEMS = [
  { key: "ai", Icon: BotIcon },
  { key: "messaging", Icon: MessageSquareIcon },
  { key: "portal", Icon: HeartHandshakeIcon },
] as const;

export async function RoadmapSection() {
  const t = await getTranslations("Marketing.whyDentord.roadmap");

  return (
    <SectionShell
      tone="mist"
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map(({ key, Icon }, index) => (
          <Reveal key={key} delayMs={index * 70}>
            <article className="h-full rounded-2xl border border-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)] bg-[var(--marketing-surface)] p-5">
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
      <p className="mt-8 max-w-[65ch] text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
        {t("note")}
      </p>
    </SectionShell>
  );
}
