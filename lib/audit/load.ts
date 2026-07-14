import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type AuditEventRow = {
  id: string;
  created_at: string;
  event_name: string;
  actor_user_id: string | null;
  operator_id: string | null;
  payload_json: Json;
  actor_name: string | null;
  operator_name: string | null;
};

const PAGE_SIZE = 50;

export async function loadAuditEvents(
  supabase: Client,
  clinicId: string,
  opts?: {
    eventName?: string | null;
    page?: number;
  },
): Promise<{ rows: AuditEventRow[]; total: number; pageSize: number }> {
  const page = Math.max(1, opts?.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("audit_events")
    .select("id, created_at, event_name, actor_user_id, operator_id, payload_json", {
      count: "exact",
    })
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts?.eventName) {
    query = query.eq("event_name", opts.eventName);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
  ];
  const operatorIds = [
    ...new Set(rows.map((r) => r.operator_id).filter(Boolean) as string[]),
  ];

  const [{ data: actors }, { data: operators }] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    operatorIds.length
      ? supabase
          .from("clinic_operators")
          .select("id, display_name")
          .in("id", operatorIds)
      : Promise.resolve({
          data: [] as { id: string; display_name: string }[],
        }),
  ]);

  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const operatorMap = new Map(
    (operators ?? []).map((o) => [o.id, o.display_name]),
  );

  return {
    rows: rows.map((r) => ({
      ...r,
      actor_name: r.actor_user_id
        ? (actorMap.get(r.actor_user_id) ?? null)
        : null,
      operator_name: r.operator_id
        ? (operatorMap.get(r.operator_id) ?? null)
        : null,
    })),
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

/** Common event names for filter dropdown (not exhaustive). */
export const AUDIT_EVENT_FILTERS = [
  "patient.created",
  "patient.updated",
  "patient.deactivated",
  "appointment.created",
  "appointment.updated",
  "appointment.cancelled",
  "invoice.created",
  "invoice.voided",
  "payment.recorded",
  "invite.created",
  "invite.revoked",
  "user.deactivated",
  "clinic.branding_colors_updated",
  "email_template.updated",
  "consent_template.updated",
  "consent.signed",
  "consent.deleted",
  "crm.notification_sent",
  "gdpr.erasure_requested",
  "gdpr.erasure_rejected",
  "gdpr.patient_erased",
  "operator.switched",
  "auth.login_lockout",
] as const;
