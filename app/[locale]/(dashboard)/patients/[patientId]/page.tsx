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
  ImageUploadForm,
  ImagesList,
} from "@/components/patients/patient-files";
import { Odontogram } from "@/components/odontogram/odontogram";
import { TreatmentPlansPanel } from "@/components/treatment-plans/treatment-plans-panel";
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
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string; patientId: string }>;
};

export default async function PatientDetailPage({ params }: Props) {
  const { locale, patientId } = await params;
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
    .select("role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canAccessPatients(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", profile!.clinic_id)
    .maybeSingle();

  if (!patient) {
    notFound();
  }

  const canWrite = canWritePatients(profile!.role) && patient.is_active;
  const canExport = canExportPatientData(profile!.role);
  const canRequestErasure = canRequestPatientErasure(profile!.role);
  const canViewOdontogram = canAccessOdontogram(profile!.role);
  const canEditOdontogram =
    canWriteOdontogram(profile!.role) && patient.is_active;
  const canViewTreatmentPlan = canAccessTreatmentPlan(profile!.role);
  const canEditTreatmentPlan =
    canWriteTreatmentPlan(profile!.role) && patient.is_active;

  const [
    { data: allergies },
    { data: documents },
    { data: images },
    odontogramData,
    treatmentPlanData,
  ] = await Promise.all([
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
    supabase
      .from("patient_images")
      .select("id, title, storage_path, size_bytes, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    canViewOdontogram
      ? Promise.all([
          supabase
            .from("odontogram_teeth")
            .select("fdi_number, status, notes")
            .eq("patient_id", patientId),
          supabase
            .from("odontogram_events")
            .select(
              "id, fdi_number, event_type, status_before, status_after, note, created_at",
            )
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(15),
        ])
      : null,
    canViewTreatmentPlan
      ? (async () => {
          const { data: plans } = await supabase
            .from("treatment_plans")
            .select("id, title, notes, is_active, created_at")
            .eq("patient_id", patientId)
            .eq("clinic_id", profile!.clinic_id)
            .order("created_at", { ascending: false });

          const planIds = (plans ?? []).map((plan) => plan.id);
          const [{ data: items }, { data: services }] = await Promise.all([
            planIds.length > 0
              ? supabase
                  .from("treatment_plan_items")
                  .select(
                    "id, treatment_plan_id, service_name, fdi_number, status, estimated_price_eur, notes, sort_order",
                  )
                  .eq("clinic_id", profile!.clinic_id)
                  .in("treatment_plan_id", planIds)
                  .order("sort_order", { ascending: true })
              : Promise.resolve({ data: [] as const }),
            supabase
              .from("services")
              .select("id, name, price_eur")
              .eq("clinic_id", profile!.clinic_id)
              .eq("is_active", true)
              .order("name", { ascending: true }),
          ]);

          return { plans: plans ?? [], items: items ?? [], services: services ?? [] };
        })()
      : null,
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link href="/patients" className="hover:underline">
              {t("backList")}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {patient.last_name} {patient.first_name}
          </h1>
          {!patient.is_active ? (
            <p className="text-destructive text-sm">{t("inactive")}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? <ExportPatientLink patientId={patient.id} /> : null}
          {canRequestErasure ? (
            <RequestErasureButton patientId={patient.id} />
          ) : null}
          {canWrite ? (
            <DeactivatePatientButton patientId={patient.id} />
          ) : null}
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>{t("imagesTitle")}</CardTitle>
          <CardDescription>{t("imagesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImagesList
            patientId={patient.id}
            canWrite={canWrite}
            images={(images ?? []).map((image) => ({
              id: image.id,
              title: image.title,
              storagePath: image.storage_path,
              sizeBytes: image.size_bytes,
              createdAt: image.created_at,
            }))}
          />
          {canWrite ? <ImageUploadForm patientId={patient.id} /> : null}
        </CardContent>
      </Card>

      {odontogramData ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("odontogramTitle")}</CardTitle>
            <CardDescription>{t("odontogramDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Odontogram
              patientId={patient.id}
              canWrite={canEditOdontogram}
              teeth={(odontogramData[0].data ?? []).map((tooth) => ({
                fdiNumber: tooth.fdi_number,
                status: tooth.status,
                notes: tooth.notes,
              }))}
              events={(odontogramData[1].data ?? []).map((event) => ({
                id: event.id,
                fdiNumber: event.fdi_number,
                eventType: event.event_type,
                statusBefore: event.status_before,
                statusAfter: event.status_after,
                note: event.note,
                createdAt: event.created_at,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {treatmentPlanData ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("treatmentPlanTitle")}</CardTitle>
            <CardDescription>{t("treatmentPlanDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TreatmentPlansPanel
              patientId={patient.id}
              canWrite={canEditTreatmentPlan}
              services={treatmentPlanData.services.map((service) => ({
                id: service.id,
                name: service.name,
                priceEur: Number(service.price_eur),
              }))}
              plans={treatmentPlanData.plans.map((plan) => ({
                id: plan.id,
                title: plan.title,
                notes: plan.notes,
                isActive: plan.is_active,
                createdAt: plan.created_at,
                items: treatmentPlanData.items
                  .filter((item) => item.treatment_plan_id === plan.id)
                  .map((item) => ({
                    id: item.id,
                    serviceName: item.service_name,
                    fdiNumber: item.fdi_number,
                    status: item.status,
                    estimatedPriceEur: Number(item.estimated_price_eur),
                    notes: item.notes,
                  })),
              }))}
            />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
