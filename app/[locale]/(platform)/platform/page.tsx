import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logoutAction } from "@/lib/auth/actions";
import { listPlatformClinics } from "@/lib/platform/data";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PlatformHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Platform");
  const clinics = await listPlatformClinics();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            {t("logout")}
          </Button>
        </form>
      </div>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.plan")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.subscription")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              clinics.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell className="font-medium">{clinic.name}</TableCell>
                  <TableCell>{clinic.planCode ?? "—"}</TableCell>
                  <TableCell>
                    {t(`clinicStatuses.${clinic.status}`)}
                  </TableCell>
                  <TableCell>
                    {clinic.subscriptionStatus
                      ? t(`subscriptionStatuses.${clinic.subscriptionStatus}`)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/platform/clinics/${clinic.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {t("open")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
