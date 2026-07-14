import {
  CalendarX2Icon,
  CircleHelpIcon,
  FileSpreadsheetIcon,
  FolderSearchIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const PAINS = [
  { key: "charts", Icon: FolderSearchIcon },
  { key: "double", Icon: CalendarX2Icon },
  { key: "invoices", Icon: FileSpreadsheetIcon },
  { key: "payments", Icon: CircleHelpIcon },
] as const;

export async function ProblemSolution() {
  const t = await getTranslations("Marketing.home.problem");

  return (
    <SectionShell tone="wash" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <ul className="space-y-4">
            {PAINS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-3">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-[var(--marketing-mist)] text-[var(--marketing-accent)]">
                  <Icon className="size-6" strokeWidth={2} />
                </span>
                <p className="pt-2.5 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_78%,transparent)] md:text-[17px]">
                  {t(`pains.${key}`)}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delayMs={80}>
          <div className="flex h-full flex-col justify-center rounded-2xl bg-[var(--marketing-surface)] p-6 md:p-8">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
              {t("solutionEyebrow")}
            </p>
            <p className="mt-3 font-[family-name:var(--font-marketing-display)] text-xl leading-snug font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
              {t("solution")}
            </p>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
