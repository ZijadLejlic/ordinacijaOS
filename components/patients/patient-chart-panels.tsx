import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ImageUploadForm,
  ImagesList,
} from "@/components/patients/patient-files";
import {
  loadConsentFormsForClinic,
  loadPatientConsentSignatures,
} from "@/lib/consent/load";
import { clinicHasFeature } from "@/lib/entitlements";
import {
  PATIENT_FILES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/patients/storage";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";

const PatientConsentPanel = dynamic(() =>
  import("@/components/consent/patient-consent-panel").then(
    (m) => m.PatientConsentPanel,
  ),
);

const Odontogram = dynamic(() =>
  import("@/components/odontogram/odontogram").then((m) => m.Odontogram),
);

const TreatmentPlansPanel = dynamic(() =>
  import("@/components/treatment-plans/treatment-plans-panel").then(
    (m) => m.TreatmentPlansPanel,
  ),
);

export function PatientChartPanelFallback() {
  return (
    <div
      className="bg-muted/30 h-48 animate-pulse rounded-xl"
      aria-busy="true"
      aria-live="polite"
    />
  );
}

export async function PatientConsentSection({
  clinicId,
  patientId,
  patientName,
  clinicName,
  locale,
  canSign,
}: {
  clinicId: string;
  patientId: string;
  patientName: string;
  clinicName: string;
  locale: string;
  canSign: boolean;
}) {
  const tConsent = await getTranslations("Consent");
  const supabase = await createClient();
  const featureOk = await clinicHasFeature(
    supabase,
    clinicId,
    "consent_draw_sign",
  );

  const [forms, signatures] = await Promise.all([
    featureOk ? loadConsentFormsForClinic(clinicId) : Promise.resolve([]),
    featureOk
      ? loadPatientConsentSignatures(clinicId, patientId)
      : Promise.resolve([]),
  ]);

  const vars = {
    ime: patientName,
    datum: formatInTimeZone(
      new Date(),
      CLINIC_TIMEZONE,
      locale === "en" ? "dd MMM yyyy" : "dd.MM.yyyy.",
    ),
    ordinacija: clinicName,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tConsent("title")}</CardTitle>
        <CardDescription>{tConsent("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <PatientConsentPanel
          patientId={patientId}
          forms={forms}
          signatures={signatures}
          vars={vars}
          canWrite={canSign}
          featureOk={featureOk}
        />
      </CardContent>
    </Card>
  );
}

export async function PatientImagesSection({
  clinicId,
  patientId,
  canWrite,
}: {
  clinicId: string;
  patientId: string;
  canWrite: boolean;
}) {
  const t = await getTranslations("Patients");
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("patient_images")
    .select("id, title, storage_path, size_bytes, created_at")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  const imageRows = await Promise.all(
    (images ?? []).map(async (image) => {
      const { data } = await supabase.storage
        .from(PATIENT_FILES_BUCKET)
        .createSignedUrl(image.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: image.id,
        title: image.title,
        storagePath: image.storage_path,
        sizeBytes: image.size_bytes,
        createdAt: image.created_at,
        previewUrl: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("imagesTitle")}</CardTitle>
        <CardDescription>{t("imagesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ImagesList
          patientId={patientId}
          canWrite={canWrite}
          images={imageRows}
        />
        {canWrite ? <ImageUploadForm patientId={patientId} /> : null}
      </CardContent>
    </Card>
  );
}

export async function PatientOdontogramSection({
  clinicId,
  patientId,
  canWrite,
}: {
  clinicId: string;
  patientId: string;
  canWrite: boolean;
}) {
  const t = await getTranslations("Patients");
  const supabase = await createClient();

  const [{ data: teeth }, { data: events }] = await Promise.all([
    supabase
      .from("odontogram_teeth")
      .select("fdi_number, status, notes")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId),
    supabase
      .from("odontogram_events")
      .select(
        "id, fdi_number, event_type, status_before, status_after, note, created_at",
      )
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("odontogramTitle")}</CardTitle>
        <CardDescription>{t("odontogramDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Odontogram
          patientId={patientId}
          canWrite={canWrite}
          teeth={(teeth ?? []).map((tooth) => ({
            fdiNumber: tooth.fdi_number,
            status: tooth.status,
            notes: tooth.notes,
          }))}
          events={(events ?? []).map((event) => ({
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
  );
}

export async function PatientTreatmentPlansSection({
  clinicId,
  patientId,
  canWrite,
}: {
  clinicId: string;
  patientId: string;
  canWrite: boolean;
}) {
  const t = await getTranslations("Patients");
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("treatment_plans")
    .select("id, title, notes, is_active, created_at")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  const planIds = (plans ?? []).map((plan) => plan.id);
  const [{ data: items }, { data: services }] = await Promise.all([
    planIds.length > 0
      ? supabase
          .from("treatment_plan_items")
          .select(
            "id, treatment_plan_id, service_name, fdi_number, status, estimated_price_eur, notes, sort_order",
          )
          .eq("clinic_id", clinicId)
          .in("treatment_plan_id", planIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as const }),
    supabase
      .from("services")
      .select("id, name, price_eur")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("treatmentPlanTitle")}</CardTitle>
        <CardDescription>{t("treatmentPlanDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TreatmentPlansPanel
          patientId={patientId}
          canWrite={canWrite}
          services={(services ?? []).map((service) => ({
            id: service.id,
            name: service.name,
            priceEur: Number(service.price_eur),
          }))}
          plans={(plans ?? []).map((plan) => ({
            id: plan.id,
            title: plan.title,
            notes: plan.notes,
            isActive: plan.is_active,
            createdAt: plan.created_at,
            items: (items ?? [])
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
  );
}
