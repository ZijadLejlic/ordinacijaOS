export type WaitlistMatchRow = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  service_id: string | null;
  location_id: string | null;
  preferred_from: string | null;
  preferred_to: string | null;
  status: string;
  priority: number;
  created_at: string;
  patient_first_name?: string | null;
  patient_last_name?: string | null;
};

type Slot = {
  doctorId: string;
  serviceId: string | null;
  locationId: string | null;
  startsAt: Date;
};

/**
 * FIFO match: higher priority first, then older created_at.
 * Matches when waitlist prefs are null (any) or equal the freed slot;
 * preferred date window includes the slot day (UTC date of startsAt).
 */
export function matchWaitlistForCancelledSlot(
  rows: WaitlistMatchRow[],
  slot: Slot,
  limit = 5,
): WaitlistMatchRow[] {
  const slotDay = slot.startsAt.toISOString().slice(0, 10);

  const matched = rows.filter((row) => {
    if (row.status !== "waiting") return false;
    if (row.doctor_id && row.doctor_id !== slot.doctorId) return false;
    if (row.service_id && slot.serviceId && row.service_id !== slot.serviceId) {
      return false;
    }
    if (
      row.location_id &&
      slot.locationId &&
      row.location_id !== slot.locationId
    ) {
      return false;
    }
    if (row.preferred_from && slotDay < row.preferred_from) return false;
    if (row.preferred_to && slotDay > row.preferred_to) return false;
    return true;
  });

  matched.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.created_at.localeCompare(b.created_at);
  });

  return matched.slice(0, limit);
}
