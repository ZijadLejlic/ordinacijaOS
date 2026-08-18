import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type BookableDoctorProfile = {
  role: AppRole;
  practices_as_doctor?: boolean | null;
};

/** Bookable calendar/invoice resource: hired doctor or practicing owner (D56). */
export function isBookableDoctor(profile: BookableDoctorProfile): boolean {
  return (
    profile.role === "doctor" ||
    (profile.role === "owner" && Boolean(profile.practices_as_doctor))
  );
}

export type BookableDoctorRow = BookableDoctorProfile & {
  id: string;
  full_name: string;
};

export function toDoctorOptions(
  rows: BookableDoctorRow[],
): { id: string; fullName: string }[] {
  return rows.filter(isBookableDoctor).map((d) => ({
    id: d.id,
    fullName: d.full_name,
  }));
}

export function countDoctorSeats(
  activeProfiles: BookableDoctorProfile[],
  pendingInvites: { role: AppRole }[],
): number {
  return (
    activeProfiles.filter(isBookableDoctor).length +
    pendingInvites.filter((i) => i.role === "doctor").length
  );
}
