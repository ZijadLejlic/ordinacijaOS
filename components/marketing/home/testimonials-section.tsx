import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

export type Testimonial = {
  quote: string;
  name: string;
  clinic: string;
  city: string;
};

type TestimonialsSectionProps = {
  /** W10 — empty/undefined keeps the section hidden until real reviews arrive. */
  items?: Testimonial[];
  eyebrow?: string;
  title?: string;
};

/**
 * Designed per Website-DentOrd §4.1 / W10; renders only when `items` has content.
 */
export function TestimonialsSection({
  items = [],
  eyebrow = "Recenzije",
  title = "Šta kažu ordinacije",
}: TestimonialsSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionShell tone="wash" eyebrow={eyebrow} title={title}>
      <div className="grid gap-5 md:grid-cols-3">
        {items.slice(0, 3).map((item, index) => (
          <Reveal key={`${item.name}-${index}`} delayMs={index * 70}>
            <blockquote className="flex h-full flex-col rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] p-6">
              <p className="flex-1 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_80%,transparent)]">
                “{item.quote}”
              </p>
              <footer className="mt-5">
                <cite className="not-italic">
                  <span className="block font-medium text-[var(--marketing-ink)]">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
                    {item.clinic}, {item.city}
                  </span>
                </cite>
              </footer>
            </blockquote>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
