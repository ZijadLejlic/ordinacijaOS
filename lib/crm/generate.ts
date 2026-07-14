import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  CRM_BIRTHDAY_WINDOW_DAYS,
  CRM_CONTROL_WINDOW_DAYS,
  CRM_RECALL_DAYS,
  type CrmKind,
} from "@/lib/crm/constants";
import { CLINIC_TIMEZONE } from "@/lib/calendar/time";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CrmCandidate = {
  patientId: string;
  kind: CrmKind;
  dueOn: string; // yyyy-MM-dd
};

function clinicTodayYmd(now = new Date(), timeZone = CLINIC_TIMEZONE): string {
  return format(toZonedTime(now, timeZone), "yyyy-MM-dd");
}

function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  return format(addDays(base, days), "yyyy-MM-dd");
}

/** Next birthday anniversary on/after today within window (inclusive). */
export function nextBirthdayDueOn(
  dateOfBirth: string,
  todayYmd: string,
  windowDays = CRM_BIRTHDAY_WINDOW_DAYS,
): string | null {
  const dob = dateOfBirth.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;

  const [, month, day] = dob.split("-");
  const year = Number(todayYmd.slice(0, 4));
  let candidate = `${year}-${month}-${day}`;

  const parsed = new Date(`${candidate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || format(parsed, "yyyy-MM-dd") !== candidate) {
    return null;
  }

  if (candidate < todayYmd) {
    candidate = `${year + 1}-${month}-${day}`;
    const nextParsed = new Date(`${candidate}T12:00:00Z`);
    if (
      Number.isNaN(nextParsed.getTime()) ||
      format(nextParsed, "yyyy-MM-dd") !== candidate
    ) {
      return null;
    }
  }

  const windowEnd = addCalendarDays(todayYmd, windowDays);
  if (candidate > windowEnd) return null;
  return candidate;
}

async function findBirthdayCandidates(
  supabase: Supabase,
  clinicId: string,
  todayYmd: string,
): Promise<CrmCandidate[]> {
  const { data: patients } = await supabase
    .from("patients")
    .select("id, date_of_birth")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .not("date_of_birth", "is", null);

  const out: CrmCandidate[] = [];
  for (const p of patients ?? []) {
    if (!p.date_of_birth) continue;
    const dueOn = nextBirthdayDueOn(p.date_of_birth, todayYmd);
    if (!dueOn) continue;
    out.push({ patientId: p.id, kind: "birthday", dueOn });
  }
  return out;
}

async function findControlCandidates(
  supabase: Supabase,
  clinicId: string,
  todayYmd: string,
): Promise<CrmCandidate[]> {
  const windowEnd = addCalendarDays(todayYmd, CRM_CONTROL_WINDOW_DAYS);
  // Include overdue controls (next_control_at in the past) up to window end.
  const { data: patients } = await supabase
    .from("patients")
    .select("id, next_control_at")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .not("next_control_at", "is", null)
    .lte("next_control_at", windowEnd);

  return (patients ?? [])
    .filter((p) => p.next_control_at)
    .map((p) => ({
      patientId: p.id,
      kind: "control" as const,
      dueOn: p.next_control_at!,
    }));
}

async function findRecallCandidates(
  supabase: Supabase,
  clinicId: string,
  todayYmd: string,
): Promise<CrmCandidate[]> {
  const cutoffYmd = addCalendarDays(todayYmd, -CRM_RECALL_DAYS);
  const cutoffIso = `${cutoffYmd}T00:00:00+02:00`;
  const nowIso = new Date().toISOString();

  const { data: patients } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("is_active", true);

  if (!patients?.length) return [];

  const patientIds = patients.map((p) => p.id);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("patient_id, starts_at, status")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds)
    .neq("status", "cancelled");

  const lastPast = new Map<string, string>();
  const hasFuture = new Set<string>();

  for (const a of appointments ?? []) {
    if (a.starts_at >= nowIso) {
      hasFuture.add(a.patient_id);
      continue;
    }
    const prev = lastPast.get(a.patient_id);
    if (!prev || a.starts_at > prev) {
      lastPast.set(a.patient_id, a.starts_at);
    }
  }

  const out: CrmCandidate[] = [];
  for (const p of patients) {
    if (hasFuture.has(p.id)) continue;
    const last = lastPast.get(p.id);
    if (!last) continue;
    if (last >= cutoffIso) continue;
    // Stable due_on = last visit + recall days (dismiss/sent sticks)
    const lastYmd = format(
      toZonedTime(new Date(last), CLINIC_TIMEZONE),
      "yyyy-MM-dd",
    );
    const dueOn = addCalendarDays(lastYmd, CRM_RECALL_DAYS);
    out.push({ patientId: p.id, kind: "recall", dueOn });
  }
  return out;
}

function candidateKey(c: CrmCandidate): string {
  return `${c.patientId}:${c.kind}:${c.dueOn}`;
}

/**
 * Insert open CRM notifications for the clinic.
 * Skips any (patient, kind, due_on) that already exists in any status.
 */
export async function ensureCrmNotifications(
  supabase: Supabase,
  clinicId: string,
  now = new Date(),
): Promise<{ inserted: number }> {
  const todayYmd = clinicTodayYmd(now);

  const [birthdays, controls, recalls] = await Promise.all([
    findBirthdayCandidates(supabase, clinicId, todayYmd),
    findControlCandidates(supabase, clinicId, todayYmd),
    findRecallCandidates(supabase, clinicId, todayYmd),
  ]);

  const candidates = [...birthdays, ...controls, ...recalls];
  if (candidates.length === 0) return { inserted: 0 };

  const { data: existing } = await supabase
    .from("crm_notifications")
    .select("patient_id, kind, due_on")
    .eq("clinic_id", clinicId)
    .in(
      "patient_id",
      [...new Set(candidates.map((c) => c.patientId))],
    );

  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.patient_id}:${r.kind}:${r.due_on}`),
  );

  const toInsert = candidates
    .filter((c) => !existingKeys.has(candidateKey(c)))
    .map((c) => ({
      clinic_id: clinicId,
      patient_id: c.patientId,
      kind: c.kind,
      due_on: c.dueOn,
      status: "open" as const,
    }));

  if (toInsert.length === 0) return { inserted: 0 };

  const { data, error } = await supabase
    .from("crm_notifications")
    .insert(toInsert)
    .select("id");

  if (error) {
    let inserted = 0;
    for (const row of toInsert) {
      const { error: insertError } = await supabase
        .from("crm_notifications")
        .insert(row);
      if (!insertError) inserted += 1;
    }
    return { inserted };
  }

  return { inserted: data?.length ?? 0 };
}
