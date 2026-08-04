import { cn } from "@/lib/utils";

/** Soft left-accent pills for appointment blocks (grid + agenda). */
const STATUS_PILL: Record<string, string> = {
  pending_confirmation:
    "border-l-amber-400 bg-amber-50/90 text-amber-950 ring-amber-100/80",
  confirmed: "border-l-sky-400 bg-sky-50/90 text-sky-950 ring-sky-100/80",
  completed:
    "border-l-emerald-400 bg-emerald-50/90 text-emerald-950 ring-emerald-100/80",
  cancelled:
    "border-l-muted-foreground/40 bg-muted/70 text-muted-foreground ring-border line-through",
  no_show: "border-l-rose-400 bg-rose-50/90 text-rose-950 ring-rose-100/80",
};

export function appointmentStatusClass(status: string, className?: string) {
  return cn(
    "border-l-[3px] ring-1",
    STATUS_PILL[status] ?? STATUS_PILL.confirmed,
    className,
  );
}
