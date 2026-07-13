import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { stopImpersonationAction } from "@/lib/platform/actions";
import { getImpersonationFromCookie } from "@/lib/platform/session";

export async function ImpersonationBanner() {
  const session = await getImpersonationFromCookie();
  if (!session) return null;

  const t = await getTranslations("Platform");

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-950 dark:text-amber-100">
          {t("impersonationBanner")}
        </p>
        <form action={stopImpersonationAction}>
          <Button type="submit" size="sm" variant="outline">
            {t("stopImpersonation")}
          </Button>
        </form>
      </div>
    </div>
  );
}
