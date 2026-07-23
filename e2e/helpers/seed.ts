import type { AppRole, DbClient } from "../../lib/security/factories";
import {
  cleanupClinics,
  createAuthUser,
  createClinicWithRoles,
  createPatient as createPatientRow,
  createServiceRow,
  randomTag,
} from "../../lib/security/factories";
import { createServiceClient } from "./supabase";

// Re-exported so existing e2e specs can keep importing `createAuthUser` from
// this module — the implementation now lives in the shared P0.9 factory
// (lib/security/factories.ts), which is also used by the security suite.
export { createAuthUser };

export type SeededUser = {
  clinicId: string;
  userId: string;
  email: string;
  password: string;
  role: AppRole;
  fullName: string;
};

export type SeededClinic = {
  clinic: SeededUser;
  doctor?: SeededUser;
  accountant?: SeededUser;
  patientId?: string;
  patientName?: string;
  serviceId?: string;
};

/** Direct clinic+profile insert (no onboarding gate — missing onboarding key = completed). */
export async function createSeededUser(
  service: DbClient,
  options: {
    clinicName: string;
    role: AppRole;
    planCode?: string;
    clinicId?: string;
  },
): Promise<SeededUser> {
  const { users } = await createClinicWithRoles(service, {
    roles: [options.role],
    clinicName: options.clinicName,
    planCode: options.planCode,
    clinicId: options.clinicId,
    emailPrefix: "e2e",
  });
  return users[0];
}

export async function createPatient(
  service: DbClient,
  clinicId: string,
  names?: { firstName?: string; lastName?: string },
) {
  return createPatientRow(service, clinicId, names);
}

export async function createService(service: DbClient, clinicId: string) {
  return createServiceRow(service, clinicId);
}

/** Clinic ready for calendar + invoice UI: doctor (calendar) + accountant (invoices), patient, service. */
export async function seedOperationalClinic(
  clinicName?: string,
): Promise<SeededClinic & { cleanupUsers: SeededUser[] }> {
  const service = createServiceClient();
  const tag = randomTag();
  const name = clinicName ?? `E2E Clinic ${tag}`;

  const { byRole } = await createClinicWithRoles(service, {
    roles: ["doctor", "accountant"],
    clinicName: name,
    emailPrefix: "e2e",
  });
  const doctor = byRole.doctor!;
  const accountant = byRole.accountant!;

  const patient = await createPatientRow(service, doctor.clinicId, {
    firstName: "Ana",
    lastName: `E2E${tag.slice(-4)}`,
  });
  const svc = await createServiceRow(service, doctor.clinicId);

  return {
    clinic: doctor,
    doctor,
    accountant,
    patientId: patient.id,
    patientName: `${patient.last_name} ${patient.first_name}`,
    serviceId: svc.id,
    cleanupUsers: [doctor, accountant],
  };
}

export async function cleanupSeededUsers(users: SeededUser[]) {
  const service = createServiceClient();
  await cleanupClinics(service, users);
}
