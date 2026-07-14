import {
  DatabaseBackupIcon,
  LockKeyholeIcon,
  ScrollTextIcon,
  ServerIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const ITEMS = [
  { key: "eu", Icon: ServerIcon },
  { key: "isolation", Icon: LockKeyholeIcon },
  { key: "rbac", Icon: UsersRoundIcon },
  { key: "gdpr", Icon: ShieldCheckIcon },
  { key: "backup", Icon: DatabaseBackupIcon },
  { key: "audit", Icon: ScrollTextIcon },
] as const;

/** Extended security section for Why DentOrd (§4.4) — Home §6 + backup + audit. */
export async function WhySecurity() {
  const t = await getTranslations("Marketing.whyDentord.security");

  return (
    <SectionShell tone="navy" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ key, Icon }, index) => (
          <Reveal key={key} delayMs={index * 60}>
            <article className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <span className="inline-flex size-12 items-center justify-center rounded-[12px] bg-white/10 text-[var(--marketing-cyan)]">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70 md:text-[15px]">
                {t(`items.${key}.body`)}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 max-w-[65ch] text-sm text-white/55">
        {t("disclaimer")}
      </p>
    </SectionShell>
  );
}
