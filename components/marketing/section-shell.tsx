import { cn } from "@/lib/utils";

type Tone = "white" | "wash" | "mist" | "navy";

const toneClass: Record<Tone, string> = {
  white: "bg-[var(--marketing-surface)] text-[var(--marketing-ink)]",
  wash: "bg-[var(--marketing-wash)] text-[var(--marketing-ink)]",
  mist: "bg-[var(--marketing-mist)] text-[var(--marketing-ink)]",
  navy: "bg-[var(--marketing-ink)] text-white",
};

type SectionShellProps = {
  id?: string;
  tone?: Tone;
  eyebrow?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  headerClassName?: string;
};

export function SectionShell({
  id,
  tone = "white",
  eyebrow,
  title,
  description,
  children,
  className,
  innerClassName,
  headerClassName,
}: SectionShellProps) {
  const isNavy = tone === "navy";

  return (
    <section
      id={id}
      className={cn("py-16 md:py-24 lg:py-28", toneClass[tone], className)}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[1200px] px-6 md:px-8",
          innerClassName,
        )}
      >
        {(eyebrow || title || description) && (
          <header className={cn("mb-10 max-w-[65ch] md:mb-14", headerClassName)}>
            {eyebrow ? (
              <p
                className={cn(
                  "text-[13px] font-medium uppercase tracking-[0.08em]",
                  isNavy
                    ? "text-[var(--marketing-cyan)]"
                    : "text-[var(--marketing-accent)]",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2
                className={cn(
                  "font-[family-name:var(--font-marketing-display)] text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[2.5rem]",
                  eyebrow && "mt-3",
                  isNavy ? "text-white" : "text-[var(--marketing-ink)]",
                )}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "mt-4 text-base leading-relaxed md:text-[17px] md:leading-[1.65]",
                  isNavy
                    ? "text-white/75"
                    : "text-[color-mix(in_oklab,var(--marketing-ink)_78%,transparent)]",
                )}
              >
                {description}
              </p>
            ) : null}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
