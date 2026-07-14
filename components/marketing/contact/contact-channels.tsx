import { MailIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ContactLeadForm } from "@/components/marketing/contact/contact-lead-form";
import { Reveal } from "@/components/marketing/reveal";
import { SectionShell } from "@/components/marketing/section-shell";
import { EMAIL_HELLO, EMAIL_SUPPORT } from "@/lib/brand/constants";

export async function ContactChannels() {
  const t = await getTranslations("Marketing.contact");

  return (
    <SectionShell tone="white" className="pt-0 md:pt-0 lg:pt-0">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start">
        <Reveal>
          <div className="rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-wash)] p-6 md:p-8">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--marketing-mist)] text-[var(--marketing-accent)]">
              <MailIcon className="size-5" aria-hidden />
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-2xl">
              {t("writeUs.title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
              {t("writeUs.body")}
            </p>
            <dl className="mt-6 space-y-4">
              <div>
                <dt className="text-[13px] font-medium uppercase tracking-[0.06em] text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
                  {t("writeUs.supportLabel")}
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${EMAIL_SUPPORT}`}
                    className="text-base font-medium text-[var(--marketing-accent)] hover:text-[var(--marketing-deep)]"
                  >
                    {EMAIL_SUPPORT}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium uppercase tracking-[0.06em] text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
                  {t("writeUs.helloLabel")}
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${EMAIL_HELLO}`}
                    className="text-base font-medium text-[var(--marketing-accent)] hover:text-[var(--marketing-deep)]"
                  >
                    {EMAIL_HELLO}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>

        <Reveal>
          <ContactLeadForm />
        </Reveal>
      </div>
    </SectionShell>
  );
}
