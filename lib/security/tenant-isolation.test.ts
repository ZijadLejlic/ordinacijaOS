import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { getSecurityTestEnv } from "@/lib/security/test-env";

type DbClient = SupabaseClient<Database>;
type AppRole = Database["public"]["Enums"]["app_role"];

type TestClinic = {
  clinicId: string;
  userId: string;
  email: string;
  password: string;
  role: AppRole;
};

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

function createSupabaseClient(url: string, key: string): DbClient {
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });
}

function randomTag() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function signInAs(
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<DbClient> {
  const client = createSupabaseClient(url, anonKey);

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signIn failed for ${email}: ${error.message}`);
  }

  return client;
}

async function createAuthUser(
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

async function createTestClinic(
  service: DbClient,
  options: {
    clinicName: string;
    role: AppRole;
    planCode?: string;
  },
): Promise<TestClinic> {
  const tag = randomTag();
  const email = `security-test-${tag}@ordinacijaos.test`;
  const password = `Test-${tag}!Aa1`;

  const user = await createAuthUser(service, email, password);

  const planCode = options.planCode ?? "professional";
  const { data: plan, error: planError } = await service
    .from("plans")
    .select("id")
    .eq("code", planCode)
    .single();

  if (planError || !plan) {
    throw new Error(planError?.message ?? "plan not found");
  }

  const { data: clinic, error: clinicError } = await service
    .from("clinics")
    .insert({
      name: options.clinicName,
      plan_id: plan.id,
      trial_ends_at: "2026-12-31T23:59:59+00:00",
    })
    .select("id")
    .single();

  if (clinicError || !clinic) {
    throw new Error(clinicError?.message ?? "clinic insert failed");
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: user.id,
    clinic_id: clinic.id,
    role: options.role,
    full_name: `Security Test ${options.role}`,
    is_active: true,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    clinicId: clinic.id,
    userId: user.id,
    email,
    password,
    role: options.role,
  };
}

async function cleanupTestData(service: DbClient, clinics: TestClinic[]) {
  for (const clinic of clinics) {
    await service.from("clinic_invites").delete().eq("clinic_id", clinic.clinicId);
    await service.from("clinic_locations").delete().eq("clinic_id", clinic.clinicId);
    await service.from("audit_events").delete().eq("clinic_id", clinic.clinicId);
    await service.from("clinic_subscriptions").delete().eq("clinic_id", clinic.clinicId);
    await service.from("profiles").delete().eq("clinic_id", clinic.clinicId);
    await service.from("clinics").delete().eq("id", clinic.clinicId);
    await service.auth.admin.deleteUser(clinic.userId);
  }
}

describeSecurity("tenant isolation & RBAC (release blocker)", () => {
  const { url, anonKey, serviceKey } = env!;
  let service: DbClient;
  let clinicA: TestClinic;
  let clinicB: TestClinic;
  const created: TestClinic[] = [];

  beforeAll(async () => {
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
    await cleanupTestData(service, created);
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
});
