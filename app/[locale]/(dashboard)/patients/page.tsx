import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PatientSearchForm } from "@/components/patients/patient-forms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessPatients, canWritePatients } from "@/lib/patients/rbac";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function PatientsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Patients");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canAccessPatients(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const canWrite = canWritePatients(profile!.role);

  const query = q?.trim() ?? "";
  let patientsQuery = supabase
    .from("patients")
    .select("id, first_name, last_name, phone, email, is_active")
    .eq("clinic_id", profile!.clinic_id)
    .order("last_name", { ascending: true });

  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    patientsQuery = patientsQuery.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }

  const { data: patients } = await patientsQuery;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <Link href="/patients/new">
            <Button type="button">{t("new")}</Button>
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("search")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientSearchForm initialQuery={query} />
        </CardContent>
      </Card>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.phone")}</TableHead>
              <TableHead>{t("columns.email")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!patients || patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <Link
                      href={{
                        pathname: "/patients/[patientId]",
                        params: { patientId: patient.id },
                      }}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {patient.last_name} {patient.first_name}
                    </Link>
                  </TableCell>
                  <TableCell>{patient.phone ?? "—"}</TableCell>
                  <TableCell>{patient.email ?? "—"}</TableCell>
                  <TableCell>
                    {patient.is_active ? t("active") : t("inactive")}
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
