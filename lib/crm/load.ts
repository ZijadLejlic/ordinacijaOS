import { ensureCrmNotifications } from "@/lib/crm/generate";
import type { CrmKind } from "@/lib/crm/constants";
import { createClient } from "@/lib/supabase/server";

export type CrmNotificationRow = {
  id: string;
  kind: CrmKind;
  dueOn: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string | null;
};

/** Ensure + list open CRM notifications (newest due first). */
export async function loadOpenCrmNotifications(
  clinicId: string,
): Promise<CrmNotificationRow[]> {
  const supabase = await createClient();
  await ensureCrmNotifications(supabase, clinicId);

  const { data } = await supabase
    .from("crm_notifications")
    .select(
      "id, kind, due_on, patient_id, patients(first_name, last_name, email)",
    )
    .eq("clinic_id", clinicId)
    .eq("status", "open")
    .order("due_on", { ascending: true });

  return (data ?? []).map((row) => {
    const patient = Array.isArray(row.patients)
      ? row.patients[0]
      : row.patients;
    return {
      id: row.id,
      kind: row.kind as CrmKind,
      dueOn: row.due_on,
      patientId: row.patient_id,
      patientFirstName: patient?.first_name ?? "",
      patientLastName: patient?.last_name ?? "",
      patientEmail: patient?.email ?? null,
    };
  });
}

export async function countOpenCrmNotifications(
  clinicId: string,
): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("crm_notifications")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "open");

  return count ?? 0;
}
