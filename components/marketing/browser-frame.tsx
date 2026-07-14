import { cn } from "@/lib/utils";

type BrowserFrameProps = {
  url: string;
  children: React.ReactNode;
  className?: string;
};

export function BrowserFrame({ url, children, className }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--marketing-mist)] bg-white",
        "shadow-[0_25px_60px_-15px_rgb(15_27_61_/_0.25)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-[var(--marketing-mist)] bg-[var(--marketing-wash)] px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[color-mix(in_oklab,var(--marketing-ink)_18%,transparent)]" />
          <span className="size-2.5 rounded-full bg-[color-mix(in_oklab,var(--marketing-ink)_18%,transparent)]" />
          <span className="size-2.5 rounded-full bg-[color-mix(in_oklab,var(--marketing-ink)_18%,transparent)]" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)] md:text-xs">
          {url}
        </div>
      </div>
      <div className="bg-[var(--marketing-wash)]">{children}</div>
    </div>
  );
}
