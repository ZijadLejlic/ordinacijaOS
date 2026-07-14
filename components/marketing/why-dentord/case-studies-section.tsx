import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

export type CaseStudy = {
  clinic: string;
  city: string;
  summary: string;
  result: string;
};

type CaseStudiesSectionProps = {
  /** W12 — empty/undefined keeps the section hidden until real case studies arrive. */
  items?: CaseStudy[];
  eyebrow?: string;
  title?: string;
};

/**
 * Designed per Website-DentOrd §4.4 / W12; renders only when `items` has content.
 */
export function CaseStudiesSection({
  items = [],
  eyebrow = "Iskustva",
  title = "Ordinacije koje su prešle na DentOrd",
}: CaseStudiesSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionShell tone="white" eyebrow={eyebrow} title={title}>
      <div className="grid gap-5 md:grid-cols-2">
        {items.slice(0, 4).map((item, index) => (
          <Reveal key={`${item.clinic}-${index}`} delayMs={index * 70}>
            <article className="flex h-full flex-col rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-wash)] p-6">
              <h3 className="font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)]">
                {item.clinic}
              </h3>
              <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
                {item.city}
              </p>
              <p className="mt-4 flex-1 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_80%,transparent)]">
                {item.summary}
              </p>
              <p className="mt-4 text-sm font-medium text-[var(--marketing-accent)]">
                {item.result}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
