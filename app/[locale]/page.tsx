import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("tagline")}</p>
      </div>
      <p className="text-muted-foreground max-w-md text-sm">{t("status")}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/signup" className={cn(buttonVariants())}>
          {t("signup")}
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
          {t("login")}
        </Link>
        <Link
          href="/"
          locale="bs"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          BS
        </Link>
        <Link
          href="/"
          locale="en"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          EN
        </Link>
      </div>
    </main>
  );
}
