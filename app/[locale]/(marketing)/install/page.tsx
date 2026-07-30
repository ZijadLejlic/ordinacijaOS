import { setRequestLocale } from "next-intl/server";
import { FinalCta } from "@/components/marketing/final-cta";
import { InstallHero } from "@/components/marketing/install/install-hero";
import { InstallNotes } from "@/components/marketing/install/install-notes";
import { InstallPlatforms } from "@/components/marketing/install/install-platforms";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "install");
}

export default async function InstallPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <InstallHero />
      <InstallPlatforms />
      <InstallNotes />
      <FinalCta />
    </main>
  );
}
