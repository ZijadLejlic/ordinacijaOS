"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { trackEvent } from "@/lib/analytics/posthog";
import {
  openDemoClinicAction,
  type OpenDemoState,
} from "@/lib/demo/actions";

type Props = {
  available: boolean;
};

export function DemoLiveCta({ available }: Props) {
  const t = useTranslations("Marketing.demo.live");
  const [state, action, pending] = useActionState<OpenDemoState, FormData>(
    async (prev, formData) => {
      trackEvent("demo_opened");
      return openDemoClinicAction(prev, formData);
    },
    null,
  );

  return (
    <section className="bg-[var(--marketing-mist)] py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <Reveal>
          <div className="rounded-2xl border border-[color-mix(in_oklab,var(--marketing-accent)_20%,transparent)] bg-white p-6 shadow-[0_25px_60px_-15px_rgb(15_27_61_/_0.12)] md:flex md:items-center md:justify-between md:gap-10 md:p-10">
            <div className="max-w-xl">
              <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
                {t("eyebrow")}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-marketing-display)] text-2xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[2rem]">
                {t("title")}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
                {t("body")}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
                <li>· {t("point1")}</li>
                <li>· {t("point2")}</li>
                <li>· {t("point3")}</li>
              </ul>
            </div>
            <div className="mt-8 shrink-0 md:mt-0">
              {available ? (
                <form action={action}>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={pending}
                    className="h-12 rounded-[10px] bg-[var(--marketing-accent)] px-6 text-white hover:bg-[var(--marketing-deep)]"
                  >
                    <Play className="mr-2 size-4" strokeWidth={2} aria-hidden />
                    {pending ? t("opening") : t("cta")}
                  </Button>
                </form>
              ) : (
                <div>
                  <Button
                    type="button"
                    size="lg"
                    disabled
                    className="h-12 rounded-[10px] px-6"
                  >
                    <Play className="mr-2 size-4" strokeWidth={2} aria-hidden />
                    {t("cta")}
                  </Button>
                  <p className="mt-2 max-w-xs text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
                    {t("unavailable")}
                  </p>
                </div>
              )}
              {state?.error ? (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {t(`errors.${state.error}`)}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
                {t("microcopy")}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
