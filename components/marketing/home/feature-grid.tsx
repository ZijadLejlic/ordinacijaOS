import {
  CalendarDaysIcon,
  FileSignatureIcon,
  MailCheckIcon,
  PackageIcon,
  ReceiptIcon,
  UsersIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";

const FEATURES = [
  { key: "charts", Icon: UsersIcon, hash: "karton" },
  { key: "calendar", Icon: CalendarDaysIcon, hash: "kalendar" },
  { key: "invoices", Icon: ReceiptIcon, hash: "finansije" },
  { key: "reminders", Icon: MailCheckIcon, hash: "podsjetnici" },
  { key: "documents", Icon: FileSignatureIcon, hash: "dokumenti" },
  { key: "inventory", Icon: PackageIcon, hash: "inventar" },
] as const;

export async function FeatureGrid() {
  const t = await getTranslations("Marketing.home.features");

  return (
    <SectionShell tone="white" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, Icon, hash }, index) => (
          <Reveal key={key} delayMs={index * 70}>
            <article className="group flex h-full flex-col rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] p-6 transition-[transform,box-shadow] duration-150 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_-20px_rgb(15_27_61_/_0.28)]">
              <span className="inline-flex size-12 items-center justify-center rounded-[12px] bg-[var(--marketing-mist)] text-[var(--marketing-accent)]">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <h3 className="mt-5 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 flex-1 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
                {t(`items.${key}.body`)}
              </p>
              <Link
                href={{ pathname: "/features", hash }}
                className="mt-4 inline-flex items-center text-sm font-medium text-[var(--marketing-accent)] transition-colors hover:text-[var(--marketing-deep)]"
              >
                {t("learnMore")}
                <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
