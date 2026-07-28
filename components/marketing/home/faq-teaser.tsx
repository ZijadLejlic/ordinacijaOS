import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FAQ_KEYS = ["free", "card", "setup", "data"] as const;

export async function FaqTeaser() {
  const t = await getTranslations("Marketing.home.faq");

  const items = FAQ_KEYS.map((key) => ({
    id: `home-${key}`,
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`),
  }));

  return (
    <SectionShell tone="white" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="relative mx-auto max-w-3xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-10 -z-10 h-40 rounded-full opacity-70 blur-3xl md:-inset-x-16"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in_oklab, var(--marketing-cyan) 18%, transparent), transparent 70%)",
          }}
        />
        <Reveal>
          <FaqAccordion items={items} source="home" />
        </Reveal>
        <Reveal delayMs={80}>
          <div className="mt-10 flex justify-center">
            <Link
              href="/faq"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 gap-2 rounded-xl border-[var(--marketing-mist)] bg-[var(--marketing-surface)] px-5 text-[var(--marketing-ink)] shadow-[0_12px_28px_-20px_rgb(15_27_61_/_0.35)] hover:bg-[var(--marketing-mist)] hover:text-[var(--marketing-deep)]",
              )}
            >
              {t("cta")}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
