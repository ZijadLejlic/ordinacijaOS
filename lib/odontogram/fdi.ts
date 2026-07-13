import type { Database } from "@/lib/supabase/database.types";

type ToothStatus = Database["public"]["Enums"]["tooth_status"];

/** Standard FDI permanent-teeth numbering (D18): quadrants 1–4, teeth 1–8. */
function quadrantTeeth(quadrant: number): number[] {
  return Array.from({ length: 8 }, (_, i) => quadrant * 10 + (i + 1));
}

export const FDI_QUADRANTS = {
  upperRight: quadrantTeeth(1),
  upperLeft: quadrantTeeth(2),
  lowerLeft: quadrantTeeth(3),
  lowerRight: quadrantTeeth(4),
} as const;

export const FDI_TEETH: readonly number[] = [
  ...FDI_QUADRANTS.upperRight,
  ...FDI_QUADRANTS.upperLeft,
  ...FDI_QUADRANTS.lowerLeft,
  ...FDI_QUADRANTS.lowerRight,
];

export function isValidFdi(n: number): boolean {
  return FDI_TEETH.includes(n);
}

export const TOOTH_STATUSES = [
  "healthy",
  "caries",
  "filled",
  "crown",
  "missing",
  "implant",
  "root_canal",
  "bridge",
  "other",
] as const satisfies readonly ToothStatus[];

export const toothStatusOptions: readonly ToothStatus[] = TOOTH_STATUSES;

/** Tailwind background classes per status for the chart UI. */
export const TOOTH_STATUS_COLORS: Record<ToothStatus, string> = {
  healthy: "bg-background",
  caries: "bg-destructive/70",
  filled: "bg-blue-400/70",
  crown: "bg-amber-400/70",
  missing: "bg-muted",
  implant: "bg-violet-400/70",
  root_canal: "bg-orange-400/70",
  bridge: "bg-teal-400/70",
  other: "bg-slate-400/70",
};

/**
 * Layout for the 4-quadrant FDI chart: upper row left-to-right is
 * quadrant 1 (right) then 2 (left) reversed for anatomical "patient-facing" view;
 * lower row mirrors quadrant 4 then 3.
 */
export const FDI_LAYOUT = {
  upperRow: [...FDI_QUADRANTS.upperRight].reverse().concat(FDI_QUADRANTS.upperLeft),
  lowerRow: [...FDI_QUADRANTS.lowerRight].reverse().concat(FDI_QUADRANTS.lowerLeft),
} as const;
