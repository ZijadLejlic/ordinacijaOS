import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const NOTE_KEYS = ["browsers", "login", "updates", "offline", "tablet"] as const;

export async function InstallNotes() {
  const t = await getTranslations("Marketing.install");

  return (
    <SectionShell
      tone="white"
      eyebrow={t("notesEyebrow")}
      title={t("notesTitle")}
      description={t("notesDescription")}
    >
      <ul className="mx-auto grid max-w-3xl gap-4">
        {NOTE_KEYS.map((key, index) => (
          <Reveal key={key} delayMs={index * 35}>
            <li className="rounded-2xl border border-[color-mix(in_oklab,var(--marketing-ink)_7%,transparent)] bg-[var(--marketing-wash)] px-5 py-4 md:px-6 md:py-5">
              <h3 className="font-[family-name:var(--font-marketing-display)] text-lg font-semibold tracking-[-0.02em] text-[var(--marketing-ink)]">
                {t(`notes.${key}.title`)}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)]">
                {t(`notes.${key}.body`)}
              </p>
            </li>
          </Reveal>
        ))}
      </ul>
    </SectionShell>
  );
}
