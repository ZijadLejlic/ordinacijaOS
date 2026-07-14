import type { LegalDocument as LegalDocumentType } from "@/lib/legal/types";

type LegalDocumentProps = {
  doc: LegalDocumentType;
  lastUpdatedLabel: string;
  tocLabel: string;
};

export function LegalDocumentView({
  doc,
  lastUpdatedLabel,
  tocLabel,
}: LegalDocumentProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12 md:px-8 md:py-16">
      <header className="max-w-3xl">
        <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
          {lastUpdatedLabel}: {doc.lastUpdated}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-marketing-display)] text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[3rem]">
          {doc.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
          {doc.description}
        </p>
        <p className="mt-4 rounded-xl border border-[var(--marketing-mist)] bg-[var(--marketing-wash)] px-4 py-3 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
          {doc.disclaimer}
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
            {tocLabel}
          </p>
          <nav aria-label={tocLabel} className="mt-3 flex flex-col gap-1.5">
            {doc.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="text-sm leading-snug text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)] transition-colors hover:text-[var(--marketing-accent)]"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="max-w-[65ch] space-y-10">
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3">
                {section.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_80%,transparent)]"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
