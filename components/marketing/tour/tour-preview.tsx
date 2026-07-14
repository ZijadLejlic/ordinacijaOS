import { cn } from "@/lib/utils";
import type { TourPreviewKind } from "@/lib/marketing/tour";

type Props = {
  kind: TourPreviewKind;
  title: string;
  rows: string[];
  annotations?: number;
};

/** CSS UI mock for tour/demo (W16 interim until §5.3 WebP screenshots). */
export function TourPreview({ kind, title, rows, annotations = 0 }: Props) {
  return (
    <div className="relative p-3 md:p-5">
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] md:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--marketing-ink)] md:text-sm">
            {title}
          </p>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--marketing-accent)]"
            style={{ background: "var(--marketing-mist)" }}
          >
            {kindLabel(kind)}
          </span>
        </div>

        {kind === "odontogram" ? (
          <OdontogramMock />
        ) : kind === "dashboard" ? (
          <DashboardMock rows={rows} />
        ) : kind === "calendar" ? (
          <CalendarMock rows={rows} />
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row, index) => (
              <li
                key={row}
                className="relative flex items-center gap-3 rounded-lg bg-[var(--marketing-wash)] px-2.5 py-2"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background:
                      index === 0
                        ? "var(--marketing-accent)"
                        : index === 1
                          ? "var(--marketing-cyan)"
                          : "var(--marketing-deep)",
                  }}
                  aria-hidden
                />
                <span className="truncate text-xs text-[var(--marketing-ink)] md:text-sm">
                  {row}
                </span>
                {annotations > 0 && index < annotations ? (
                  <AnnotationDot n={index + 1} className="-right-1 -top-1" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function kindLabel(kind: TourPreviewKind) {
  const map: Partial<Record<TourPreviewKind, string>> = {
    signup: "signup",
    onboarding: "setup",
    odontogram: "FDI",
    dashboard: "KPI",
    calendar: "week",
  };
  return map[kind] ?? "UI";
}

function AnnotationDot({
  n,
  className,
}: {
  n: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "absolute flex size-5 items-center justify-center rounded-full bg-[var(--marketing-accent)] text-[10px] font-semibold text-white shadow-sm",
        "motion-safe:animate-pulse",
        className,
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

function OdontogramMock() {
  const teeth = Array.from({ length: 16 }, (_, i) => i);
  return (
    <div className="relative mt-4 space-y-3">
      <div className="flex flex-wrap justify-center gap-1">
        {teeth.map((i) => (
          <span
            key={`u-${i}`}
            className={cn(
              "size-5 rounded-sm md:size-6",
              i === 5 || i === 11
                ? "bg-[var(--marketing-accent)]"
                : "bg-[var(--marketing-mist)]",
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {teeth.map((i) => (
          <span
            key={`l-${i}`}
            className={cn(
              "size-5 rounded-sm md:size-6",
              i === 3
                ? "bg-[var(--marketing-cyan)]"
                : "bg-[var(--marketing-mist)]",
            )}
          />
        ))}
      </div>
      <AnnotationDot n={1} className="left-[38%] top-2" />
      <AnnotationDot n={2} className="right-[28%] top-2" />
      <AnnotationDot n={3} className="left-[22%] bottom-2" />
    </div>
  );
}

function DashboardMock({ rows }: { rows: string[] }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {rows.slice(0, 3).map((label, i) => (
          <div
            key={label}
            className="relative rounded-lg bg-[var(--marketing-wash)] px-2 py-2"
          >
            <p className="truncate text-[10px] text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
              {label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-marketing-display)] text-sm font-semibold text-[var(--marketing-ink)]">
              {i === 0 ? "12" : i === 1 ? "480 €" : "8"}
            </p>
            {i < 2 ? <AnnotationDot n={i + 1} className="-right-1 -top-1" /> : null}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.slice(3).map((row) => (
          <div
            key={row}
            className="rounded-md bg-[var(--marketing-wash)] px-2.5 py-1.5 text-xs text-[var(--marketing-ink)]"
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarMock({ rows }: { rows: string[] }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-1.5">
      {["Pon", "Uto", "Sri", "Čet", "Pet"].map((d, i) => (
        <div key={d} className="min-h-20 rounded-lg bg-[var(--marketing-wash)] p-1.5">
          <p className="text-[10px] font-medium text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
            {d}
          </p>
          {rows[i] ? (
            <div className="relative mt-1 rounded bg-[var(--marketing-mist)] px-1 py-0.5 text-[9px] leading-tight text-[var(--marketing-ink)]">
              {rows[i]}
              {i === 0 ? (
                <AnnotationDot n={1} className="-right-1 -top-1" />
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
