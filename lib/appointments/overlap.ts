/** Map Postgres EXCLUDE / unique_violation from appointments_no_doctor_overlap. */
export function isAppointmentOverlapError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "23P01") return true; // exclusion_violation
  if (error.code === "23505") return true; // unique_violation (fallback)
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("appointments_no_doctor_overlap") ||
    msg.includes("conflicting key value") ||
    msg.includes("exclusion constraint")
  );
}
