import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AllergyWarningBanner } from "@/components/patients/allergy-warning-banner";
import {
  AllergiesTable,
  AllergyForm,
  DeactivatePatientButton,
  PatientForm,
} from "@/components/patients/patient-forms";
import {
  ExportPatientLink,
  RequestErasureButton,
} from "@/components/privacy/privacy-forms";
import {
  DocumentUploadForm,
  DocumentsList,
} from "@/components/patients/patient-files";
import {
  PatientChartPanelFallback,
  PatientConsentSection,
  PatientImagesSection,
  PatientOdontogramSection,
  PatientTreatmentPlansSection,
} from "@/components/patients/patient-chart-panels";
import { canSignConsents } from "@/lib/consent/rbac";
import {
  canAccessOdontogram,
  canAccessPatients,
  canAccessTreatmentPlan,
  canWriteOdontogram,
  canWritePatients,
  canWriteTreatmentPlan,
} from "@/lib/patients/rbac";
import {
  canExportPatientData,
  canRequestPatientErasure,
} from "@/lib/privacy/rbac";
import { getClinicContext } from "@/lib/supabase/clinic-context";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string; patientId: string }>;
};

export default async function PatientDetailPage({ params }: Props) {
  const { locale, patientId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Patients");
  const supabase = await createClient();

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { profile, clinic } = ctx!;

  if (!canAccessPatients(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const clinicName = clinic?.name ?? "";

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!patient) {
    notFound();
  }

  const canWrite = canWritePatients(profile.role) && patient.is_active;
  const canExport = canExportPatientData(profile.role);
  const canRequestErasure = canRequestPatientErasure(profile.role);
  const canViewOdontogram = canAccessOdontogram(profile.role);
  const canEditOdontogram =
    canWriteOdontogram(profile.role) && patient.is_active;
  const canViewTreatmentPlan = canAccessTreatmentPlan(profile.role);
  const canEditTreatmentPlan =
    canWriteTreatmentPlan(profile.role) && patient.is_active;
  const canSign = canSignConsents(profile.role) && patient.is_active;

  const [{ data: allergies }, { data: documents }] = await Promise.all([
    supabase
      .from("patient_allergies")
      .select("id, allergen, severity, notes")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_documents")
      .select("id, title, storage_path, size_bytes, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  const patientName = `${patient.first_name} ${patient.last_name}`.trim();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">
            <Link href="/patients" className="hover:underline">
              {t("backList")}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {patient.last_name} {patient.first_name}
          </h1>
          {!patient.is_active ? (
            <p className="text-destructive text-sm">{t("inactive")}</p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {canExport ? <ExportPatientLink patientId={patient.id} /> : null}
          {canRequestErasure ? (
            <RequestErasureButton patientId={patient.id} />
          ) : null}
          {canWrite ? (
            <DeactivatePatientButton patientId={patient.id} />
          ) : null}
        </div>
      </div>

      <AllergyWarningBanner allergies={allergies ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>{t("chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientForm
            mode="edit"
            disabled={!canWrite}
            patient={{
              id: patient.id,
              firstName: patient.first_name,
              lastName: patient.last_name,
              phone: patient.phone ?? "",
              email: patient.email ?? "",
              dateOfBirth: patient.date_of_birth ?? "",
              nextControlAt: patient.next_control_at ?? "",
              address: patient.address ?? "",
              medicalHistory: patient.medical_history ?? "",
              notes: patient.notes ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("allergiesTitle")}</CardTitle>
          <CardDescription>{t("allergiesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AllergiesTable
            patientId={patient.id}
            allergies={allergies ?? []}
            canWrite={canWrite}
          />
          {canWrite ? <AllergyForm patientId={patient.id} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("documentsTitle")}</CardTitle>
          <CardDescription>{t("documentsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DocumentsList
            patientId={patient.id}
            canWrite={canWrite}
            documents={(documents ?? []).map((doc) => ({
              id: doc.id,
              title: doc.title,
              storagePath: doc.storage_path,
              sizeBytes: doc.size_bytes,
              createdAt: doc.created_at,
            }))}
          />
          {canWrite ? <DocumentUploadForm patientId={patient.id} /> : null}
        </CardContent>
      </Card>

      <Suspense fallback={<PatientChartPanelFallback />}>
        <PatientConsentSection
          clinicId={profile.clinic_id}
          patientId={patient.id}
          patientName={patientName}
          clinicName={clinicName}
          locale={locale}
          canSign={canSign}
        />
      </Suspense>

      <Suspense fallback={<PatientChartPanelFallback />}>
        <PatientImagesSection
          clinicId={profile.clinic_id}
          patientId={patient.id}
          canWrite={canWrite}
        />
      </Suspense>

      {canViewOdontogram ? (
        <Suspense fallback={<PatientChartPanelFallback />}>
          <PatientOdontogramSection
            clinicId={profile.clinic_id}
            patientId={patient.id}
            canWrite={canEditOdontogram}
          />
        </Suspense>
      ) : null}

      {canViewTreatmentPlan ? (
        <Suspense fallback={<PatientChartPanelFallback />}>
          <PatientTreatmentPlansSection
            clinicId={profile.clinic_id}
            patientId={patient.id}
            canWrite={canEditTreatmentPlan}
          />
        </Suspense>
      ) : null}
    </main>
  );
}
