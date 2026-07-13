import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform/admin";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PlatformLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }
  if (!isPlatformAdmin(user)) {
    redirect({ href: "/dashboard", locale });
  }

  return (
    <div className="bg-muted/30 flex min-h-full flex-1 flex-col">{children}</div>
  );
}
