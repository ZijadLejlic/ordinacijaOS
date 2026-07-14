import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const ROWS = [
  "charts",
  "appointments",
  "invoices",
  "reminders",
  "reports",
  "team",
] as const;

export async function BeforeAfter() {
  const t = await getTranslations("Marketing.whyDentord.beforeAfter");

  return (
    <SectionShell
      tone="wash"
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)]">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 border-b border-[var(--marketing-mist)] bg-[var(--marketing-wash)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)] md:px-6">
          <span>{t("beforeLabel")}</span>
          <span className="px-2" aria-hidden />
          <span className="text-right md:text-left">{t("afterLabel")}</span>
        </div>
        <ul className="divide-y divide-[var(--marketing-mist)]">
          {ROWS.map((key, index) => (
            <li key={key}>
              <Reveal delayMs={index * 50}>
                <div className="grid grid-cols-1 gap-3 px-4 py-5 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4 md:px-6">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)] text-[color-mix(in_oklab,var(--marketing-ink)_45%,transparent)]">
                      <XIcon className="size-3" strokeWidth={2.5} />
                    </span>
                    <p className="text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_72%,transparent)] md:text-[15px]">
                      {t(`rows.${key}.before`)}
                    </p>
                  </div>
                  <ArrowRightIcon
                    className="mx-auto hidden size-4 text-[var(--marketing-accent)] md:block"
                    aria-hidden
                  />
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--marketing-mist)] text-[var(--marketing-accent)]">
                      <CheckIcon className="size-3" strokeWidth={2.5} />
                    </span>
                    <p className="text-sm leading-relaxed font-medium text-[var(--marketing-ink)] md:text-[15px]">
                      {t(`rows.${key}.after`)}
                    </p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
