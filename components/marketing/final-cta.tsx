import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FinalCtaProps = {
  titleKey?: "default" | "demo" | "contact" | "tour";
  className?: string;
};

export async function FinalCta({
  titleKey = "default",
  className,
}: FinalCtaProps) {
  const t = await getTranslations("Marketing.finalCta");

  return (
    <section
      className={cn(
        "relative overflow-hidden bg-[var(--marketing-mist)] py-16 md:py-24",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-[var(--marketing-accent)] opacity-[0.12] blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-10 size-64 rounded-full bg-[var(--marketing-cyan)] opacity-[0.14] blur-[100px]"
      />
      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-start px-6 md:items-center md:px-8 md:text-center">
        <h2 className="max-w-2xl font-[family-name:var(--font-marketing-display)] text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[2.5rem]">
          {t(`titles.${titleKey}`)}
        </h2>
        {titleKey === "default" ? null : (
          <p className="mt-4 max-w-xl text-base text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)] md:text-[17px]">
            {t(`subtitles.${titleKey}`)}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3 md:justify-center">
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 rounded-[10px] bg-[var(--marketing-accent)] px-5 text-white hover:bg-[var(--marketing-deep)]",
            )}
          >
            {t("primary")}
          </Link>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 rounded-[10px] border-[color-mix(in_oklab,var(--marketing-ink)_22%,transparent)] bg-transparent px-5 text-[var(--marketing-ink)] hover:bg-white/70",
            )}
          >
            {t("secondary")}
          </Link>
        </div>
        <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_55%,transparent)]">
          {t("microcopy")}
        </p>
      </div>
    </section>
  );
}
