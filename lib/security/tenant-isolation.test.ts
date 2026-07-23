import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  signInAs,
  type AppRole,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

type TestClinic = TestUser;

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

/** P0.9: thin wrapper over the shared factory — keeps call sites below unchanged. */
async function createTestClinic(
  service: DbClient,
  options: {
    clinicName: string;
    role: AppRole;
    planCode?: string;
  },
): Promise<TestClinic> {
  const { users } = await createClinicWithRoles(service, {
    roles: [options.role],
    clinicName: options.clinicName,
    planCode: options.planCode,
    emailPrefix: "security-test",
  });
  return users[0];
}

describeSecurity("tenant isolation & RBAC (release blocker)", () => {
  // `env` is only non-null when describeSecurity === describe (not describe.skip).
  // Destructuring lazily inside beforeAll (rather than here in the describe body,
  // which vitest always executes to discover the suite) keeps the "no DB configured"
  // path a clean skip instead of a TypeError on `env!`.
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let clinicA: TestClinic;
  let clinicB: TestClinic;
  const created: TestClinic[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    clinicA = await createTestClinic(service, {
      clinicName: `Tenant A ${randomTag()}`,
      role: "doctor",
    });
    clinicB = await createTestClinic(service, {
      clinicName: `Tenant B ${randomTag()}`,
      role: "doctor",
    });
    created.push(clinicA, clinicB);
  }, 60_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  it("clinic A doctor cannot read clinic B profiles", async () => {
    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);

    const { data, error } = await client
      .from("profiles")
      .select("id, clinic_id")
      .eq("clinic_id", clinicB.clinicId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("clinic A doctor cannot read clinic B audit events", async () => {
    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);

    const { data, error } = await client
      .from("audit_events")
      .select("id")
      .eq("clinic_id", clinicB.clinicId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("doctor cannot self-promote to owner (RLS + trigger)", async () => {
    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);

    const { data: before } = await client
      .from("profiles")
      .select("role")
      .eq("id", clinicA.userId)
      .single();

    expect(before?.role).toBe("doctor");

    const { error } = await client
      .from("profiles")
      .update({ role: "owner" })
      .eq("id", clinicA.userId);

    expect(error).not.toBeNull();

    const { data: after } = await service
      .from("profiles")
      .select("role")
      .eq("id", clinicA.userId)
      .single();

    expect(after?.role).toBe("doctor");
  });

  it("doctor can update own full_name only", async () => {
    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);
    const newName = `Renamed ${randomTag()}`;

    const { error } = await client
      .from("profiles")
      .update({ full_name: newName })
      .eq("id", clinicA.userId);

    expect(error).toBeNull();

    const { data } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", clinicA.userId)
      .single();

    expect(data?.full_name).toBe(newName);
  });

  it("starter plan blocks invite insert over user limit at DB layer", async () => {
    const ownerClinic = await createTestClinic(service, {
      clinicName: `Starter limit ${randomTag()}`,
      role: "owner",
      planCode: "starter",
    });
    created.push(ownerClinic);

    const { data: plan } = await service
      .from("plans")
      .select("limits_json")
      .eq("code", "starter")
      .single();

    const userLimit =
      plan?.limits_json &&
      typeof plan.limits_json === "object" &&
      !Array.isArray(plan.limits_json) &&
      typeof plan.limits_json.users === "number"
        ? plan.limits_json.users
        : 3;

    for (let i = 0; i < userLimit - 1; i += 1) {
      const { error: inviteError } = await service.from("clinic_invites").insert({
        clinic_id: ownerClinic.clinicId,
        email: `invite-${randomTag()}-${i}@ordinacijaos.test`,
        full_name: `Invite ${i}`,
        role: "reception",
        token_hash: `${i.toString(16).padStart(64, "a")}`,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        status: "pending",
        invited_by: ownerClinic.userId,
      });

      expect(inviteError).toBeNull();
    }

    const ownerClient = await signInAs(
      url,
      anonKey,
      ownerClinic.email,
      ownerClinic.password,
    );

    const { error: limitError } = await ownerClient.from("clinic_invites").insert({
      clinic_id: ownerClinic.clinicId,
      email: `invite-over-${randomTag()}@ordinacijaos.test`,
      full_name: "Over limit",
      role: "reception",
      token_hash: `b${randomTag().replace(/[^a-f0-9]/g, "0").slice(0, 63)}`,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      status: "pending",
      invited_by: ownerClinic.userId,
    });

    expect(limitError).not.toBeNull();
    expect(limitError?.message.toLowerCase()).toContain("plan_limit_users");
  }, 60_000);

  it("locks account after 5 failed login attempts (D13)", async () => {
    const lockClinic = await createTestClinic(service, {
      clinicName: `Lockout ${randomTag()}`,
      role: "doctor",
    });
    created.push(lockClinic);

    const anonClient = createSupabaseClient(url, anonKey);

    for (let i = 0; i < 5; i += 1) {
      const { error } = await anonClient.rpc("record_failed_login", {
        p_email: lockClinic.email,
      });
      expect(error).toBeNull();
    }

    const { data: profile } = await service
      .from("profiles")
      .select("failed_login_count, locked_until")
      .eq("id", lockClinic.userId)
      .single();

    expect(profile?.failed_login_count).toBe(5);
    expect(profile?.locked_until).not.toBeNull();

    const { error: lockError } = await anonClient.rpc("check_login_lockout", {
      p_email: lockClinic.email,
    });
    expect(lockError).not.toBeNull();
    expect(lockError?.message.toLowerCase()).toContain("locked");

    const { data: audit } = await service
      .from("audit_events")
      .select("event_name")
      .eq("clinic_id", lockClinic.clinicId)
      .eq("event_name", "auth.login_lockout");

    expect(audit?.length).toBe(1);

    await service
      .from("profiles")
      .update({ failed_login_count: 0, locked_until: null })
      .eq("id", lockClinic.userId);
  }, 30_000);

  it("clinic A cannot read clinic B patients", async () => {
    const { data: patientB, error: insertError } = await service
      .from("patients")
      .insert({
        clinic_id: clinicB.clinicId,
        first_name: "Isolated",
        last_name: "PatientB",
        is_active: true,
      })
      .select("id")
      .single();

    expect(insertError).toBeNull();
    expect(patientB?.id).toBeTruthy();

    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);
    const { data, error } = await client
      .from("patients")
      .select("id")
      .eq("id", patientB!.id);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: byClinic } = await client
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicB.clinicId);

    expect(byClinic ?? []).toHaveLength(0);
  });

  it("clinic A cannot read clinic B appointments", async () => {
    const { data: patientB } = await service
      .from("patients")
      .insert({
        clinic_id: clinicB.clinicId,
        first_name: "Appt",
        last_name: "PatientB",
        is_active: true,
      })
      .select("id")
      .single();

    const starts = new Date(Date.now() + 86_400_000);
    const ends = new Date(starts.getTime() + 30 * 60_000);

    const { data: apptB, error: apptError } = await service
      .from("appointments")
      .insert({
        clinic_id: clinicB.clinicId,
        doctor_id: clinicB.userId,
        patient_id: patientB!.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: "confirmed",
      })
      .select("id")
      .single();

    expect(apptError).toBeNull();
    expect(apptB?.id).toBeTruthy();

    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);
    const { data, error } = await client
      .from("appointments")
      .select("id")
      .eq("id", apptB!.id);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("clinic A cannot list or download clinic B storage objects", async () => {
    const { data: patientB } = await service
      .from("patients")
      .insert({
        clinic_id: clinicB.clinicId,
        first_name: "File",
        last_name: "PatientB",
        is_active: true,
      })
      .select("id")
      .single();

    const path = `${clinicB.clinicId}/${patientB!.id}/documents/isolation-test.pdf`;
    const pdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc3, 0xa4,
      0xc3, 0xbc, 0xc3, 0xb6, 0x0a,
    ]);

    const { error: uploadError } = await service.storage
      .from("patient-files")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    expect(uploadError).toBeNull();

    const client = await signInAs(url, anonKey, clinicA.email, clinicA.password);

    const { data: downloaded, error: downloadError } = await client.storage
      .from("patient-files")
      .download(path);

    expect(downloaded).toBeNull();
    expect(downloadError).not.toBeNull();

    const { data: listed } = await client.storage
      .from("patient-files")
      .list(clinicB.clinicId, { limit: 10 });

    expect(listed ?? []).toHaveLength(0);

    const anon = createSupabaseClient(url, anonKey);
    const { data: publicList } = await anon.storage
      .from("patient-files")
      .list("", { limit: 10 });
    expect(publicList ?? []).toHaveLength(0);
  }, 30_000);
});
