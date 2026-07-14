import { getTranslations } from "next-intl/server";
import { BrowserFrame } from "@/components/marketing/browser-frame";

export async function DashboardPreview() {
  const t = await getTranslations("Marketing.home.hero");

  return (
    <BrowserFrame url={t("browserUrl")} className="w-full">
      <div className="space-y-3 p-3 md:space-y-4 md:p-5">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { label: t("mock.kpiPatients"), value: "12" },
            { label: t("mock.kpiRevenue"), value: "480 €" },
            { label: t("mock.kpiAppointments"), value: "8" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl bg-white px-2.5 py-2.5 shadow-sm ring-1 ring-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] md:px-3 md:py-3"
            >
              <p className="truncate text-[10px] text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)] md:text-xs">
                {kpi.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-marketing-display)] text-base font-semibold tracking-tight text-[var(--marketing-ink)] md:text-xl">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] md:p-4">
          <p className="text-xs font-medium text-[var(--marketing-ink)] md:text-sm">
            {t("mock.scheduleTitle")}
          </p>
          <ul className="mt-3 space-y-2">
            {(
              [
                ["time1", "appt1", "var(--marketing-accent)"],
                ["time2", "appt2", "var(--marketing-cyan)"],
                ["time3", "appt3", "var(--marketing-deep)"],
              ] as const
            ).map(([timeKey, apptKey, color]) => (
              <li
                key={timeKey}
                className="flex items-center gap-3 rounded-lg bg-[var(--marketing-wash)] px-2.5 py-2"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="w-11 shrink-0 font-mono text-[11px] text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)] md:text-xs">
                  {t(`mock.${timeKey}`)}
                </span>
                <span className="truncate text-xs text-[var(--marketing-ink)] md:text-sm">
                  {t(`mock.${apptKey}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BrowserFrame>
  );
}
