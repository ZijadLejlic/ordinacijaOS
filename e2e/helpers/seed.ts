import type { Database, Json } from "../../lib/supabase/database.types";
import {
  createServiceClient,
  randomTag,
  type AppRole,
  type DbClient,
} from "./supabase";

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

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export async function createAuthUser(
  service: DbClient,
  email: string,
  password: string,
) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "createUser failed");
  }
  return data.user;
}

async function resolvePlanId(service: DbClient, planCode = "professional") {
  const { data: plan, error } = await service
    .from("plans")
    .select("id")
    .eq("code", planCode)
    .single();
  if (error || !plan) {
    throw new Error(error?.message ?? `plan ${planCode} not found`);
  }
  return plan.id;
}

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
  const tag = randomTag();
  const email = `e2e-${options.role}-${tag}@ordinacijaos.test`;
  const password = `E2E-${tag}!Aa1`;
  const fullName = `E2E ${options.role} ${tag}`;

  const user = await createAuthUser(service, email, password);
  let clinicId = options.clinicId;

  if (!clinicId) {
    const planId = await resolvePlanId(service, options.planCode);
    const { data: clinic, error: clinicError } = await service
      .from("clinics")
      .insert({
        name: options.clinicName,
        plan_id: planId,
        trial_ends_at: "2026-12-31T23:59:59+00:00",
        settings_json: {} as Json,
      })
      .select("id")
      .single();

    if (clinicError || !clinic) {
      throw new Error(clinicError?.message ?? "clinic insert failed");
    }
    clinicId = clinic.id;
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: user.id,
    clinic_id: clinicId,
    role: options.role,
    full_name: fullName,
    is_active: true,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    clinicId,
    userId: user.id,
    email,
    password,
    role: options.role,
    fullName,
  };
}

export async function createPatient(
  service: DbClient,
  clinicId: string,
  names?: { firstName?: string; lastName?: string },
): Promise<Pick<PatientRow, "id" | "first_name" | "last_name">> {
  const tag = randomTag().slice(-6);
  const firstName = names?.firstName ?? `Pacijent${tag}`;
  const lastName = names?.lastName ?? `Test${tag}`;

  const { data, error } = await service
    .from("patients")
    .insert({
      clinic_id: clinicId,
      first_name: firstName,
      last_name: lastName,
      phone: "+38761123456",
      is_active: true,
    })
    .select("id, first_name, last_name")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "patient insert failed");
  }
  return data;
}

export async function createService(
  service: DbClient,
  clinicId: string,
): Promise<{ id: string; name: string; duration_minutes: number }> {
  const tag = randomTag().slice(-6);
  const { data, error } = await service
    .from("services")
    .insert({
      clinic_id: clinicId,
      name: `E2E Usluga ${tag}`,
      code: `E2E-${tag}`,
      duration_minutes: 30,
      price_eur: 50,
      vat_rate: 0,
      is_active: true,
    })
    .select("id, name, duration_minutes")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "service insert failed");
  }
  return data;
}

/** Clinic ready for calendar + invoice UI: doctor (calendar) + accountant (invoices), patient, service. */
export async function seedOperationalClinic(
  clinicName?: string,
): Promise<SeededClinic & { cleanupUsers: SeededUser[] }> {
  const service = createServiceClient();
  const tag = randomTag();
  const name = clinicName ?? `E2E Clinic ${tag}`;

  const doctor = await createSeededUser(service, {
    clinicName: name,
    role: "doctor",
  });
  const accountant = await createSeededUser(service, {
    clinicName: name,
    role: "accountant",
    clinicId: doctor.clinicId,
  });
  const patient = await createPatient(service, doctor.clinicId, {
    firstName: "Ana",
    lastName: `E2E${tag.slice(-4)}`,
  });
  const svc = await createService(service, doctor.clinicId);

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
  const clinicIds = [...new Set(users.map((u) => u.clinicId))];

  for (const clinicId of clinicIds) {
    await service
      .from("clinics")
      .update({ status: "pending_delete" })
      .eq("id", clinicId);

    const { error } = await service.rpc("hard_delete_clinic", {
      p_clinic_id: clinicId,
    });
    if (error) {
      console.warn(`hard_delete_clinic(${clinicId}): ${error.message}`);
      // Fallback: delete profiles then clinic (auth users separately)
      await service.from("profiles").delete().eq("clinic_id", clinicId);
      await service.from("clinics").delete().eq("id", clinicId);
    }
  }

  for (const user of users) {
    await service.auth.admin.deleteUser(user.userId).catch(() => undefined);
  }
}
