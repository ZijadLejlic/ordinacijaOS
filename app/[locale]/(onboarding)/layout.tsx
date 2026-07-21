import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Minimal chrome for the owner onboarding wizard (PRD §6.1). */
export default async function OnboardingLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="bg-background flex min-h-full flex-1 flex-col">
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
