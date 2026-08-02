import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PatientForm } from "@/components/patients/patient-forms";
import { canWritePatients } from "@/lib/patients/rbac";
import { getClinicContext } from "@/lib/supabase/clinic-context";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewPatientPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Patients");

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { profile } = ctx!;

  if (!canWritePatients(profile.role)) {
    redirect({ href: "/patients", locale });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/patients" className="hover:underline">
            {t("backList")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("newTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("newDescription")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientForm mode="create" />
        </CardContent>
      </Card>
    </main>
  );
}
