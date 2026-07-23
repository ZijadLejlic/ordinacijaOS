import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import type { Database } from "../supabase/database.types";

/**
 * P0.9 (docs/QA/Implementation-Plan.md): single shared factory module for
 * the "insert an auth user + clinic + profile row directly via service
 * role" pattern that used to be copy-pasted (and drifting — different
 * cleanup fallback tables, different email prefixes) across:
 *   - lib/security/tenant-isolation.test.ts   (createTestClinic)
 *   - lib/security/rbac-and-lifecycle.test.ts (createClinicUser)
 *   - e2e/helpers/seed.ts                     (createSeededUser)
 *
 * This bypasses onboarding/signup UI and MFA enrollment on purpose — it's
 * for tests that need a ready clinic+role fast, not for exercising signup
 * itself (see e2e/signup-onboarding.spec.ts for that journey).
 *
 * Uses relative imports (not the `@/*` tsconfig alias) so this module
 * resolves identically from Vitest (lib/security/*.test.ts) and from
 * Playwright's e2e/helpers, which don't share a module resolution config.
 */

export type DbClient = SupabaseClient<Database, "public">;
export type AppRole = Database["public"]["Enums"]["app_role"];

export type TestUser = {
  clinicId: string;
  userId: string;
  email: string;
  password: string;
  role: AppRole;
  fullName: string;
};

export type ClinicWithRoles = {
  clinicId: string;
  /** All created users, in the same order as `options.roles`. */
  users: TestUser[];
  /** Convenience lookup by role. If a role was requested more than once, holds the last one created. */
  byRole: Partial<Record<AppRole, TestUser>>;
};

export function createSupabaseClient(url: string, key: string): DbClient {
  return createClient<Database, "public">(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });
}

export function randomTag(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function signInAs(
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

export async function resolvePlanId(
  service: DbClient,
  planCode = "professional",
): Promise<string> {
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

/**
 * Creates one clinic (or reuses `options.clinicId`) plus one profile per
 * requested role, via direct service-role inserts (no onboarding gate, no
 * MFA enrollment). Roles are created in order; when no `clinicId` is
 * passed, the clinic row is inserted alongside the first role's profile,
 * and every subsequent role is attached to that same clinic — this covers
 * both "one clinic, one role" (tenant isolation A/B setups) and "one
 * clinic, every role" (RBAC matrix setups) in a single call.
 *
 * Pass an existing `clinicId` to add role(s) to an already-created clinic
 * (e.g. a second, unrelated clinic used only for a cross-tenant probe).
 */
export async function createClinicWithRoles(
  service: DbClient,
  options: {
    roles: AppRole[];
    clinicName?: string;
    planCode?: string;
    clinicId?: string;
    /** Namespaces generated emails/full names, e.g. "security", "rbac", "e2e". */
    emailPrefix?: string;
  },
): Promise<ClinicWithRoles> {
  if (options.roles.length === 0) {
    throw new Error("createClinicWithRoles: `roles` must not be empty");
  }

  const emailPrefix = options.emailPrefix ?? "test";
  let clinicId = options.clinicId;
  const users: TestUser[] = [];

  for (const role of options.roles) {
    const tag = randomTag();
    const email = `${emailPrefix}-${role}-${tag}@ordinacijaos.test`;
    const password = `Test-${tag}!Aa1`;
    const fullName = `${emailPrefix} ${role} ${tag}`;

    const user = await createAuthUser(service, email, password);

    if (!clinicId) {
      const planId = await resolvePlanId(service, options.planCode);
      const { data: clinic, error: clinicError } = await service
        .from("clinics")
        .insert({
          name: options.clinicName ?? `${emailPrefix} clinic ${tag}`,
          plan_id: planId,
          trial_ends_at: "2026-12-31T23:59:59+00:00",
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
      role,
      full_name: fullName,
      is_active: true,
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    users.push({ clinicId, userId: user.id, email, password, role, fullName });
  }

  const byRole: Partial<Record<AppRole, TestUser>> = {};
  for (const user of users) {
    byRole[user.role] = user;
  }

  return { clinicId: clinicId!, users, byRole };
}

export async function createPatient(
  service: DbClient,
  clinicId: string,
  names?: { firstName?: string; lastName?: string },
): Promise<{ id: string; first_name: string; last_name: string }> {
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

export async function createServiceRow(
  service: DbClient,
  clinicId: string,
): Promise<{ id: string; name: string; duration_minutes: number }> {
  const tag = randomTag().slice(-6);
  const { data, error } = await service
    .from("services")
    .insert({
      clinic_id: clinicId,
      name: `Test Usluga ${tag}`,
      code: `TEST-${tag}`,
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

/**
 * Best-effort teardown: mark each distinct clinic `pending_delete`, try the
 * `hard_delete_clinic` RPC (which should cascade everything), and fall back
 * to manual deletes across every table any of these tests write to
 * directly if the RPC errors. Always deletes the auth users last, and
 * never throws — callers run this from `afterAll`.
 */
export async function cleanupClinics(
  service: DbClient,
  users: TestUser[],
): Promise<void> {
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
      await service.from("gdpr_erasure_requests").delete().eq("clinic_id", clinicId);
      await service.from("clinic_operators").delete().eq("clinic_id", clinicId);
      await service.from("clinic_invites").delete().eq("clinic_id", clinicId);
      await service.from("clinic_locations").delete().eq("clinic_id", clinicId);
      await service.from("patients").delete().eq("clinic_id", clinicId);
      await service.from("audit_events").delete().eq("clinic_id", clinicId);
      await service.from("clinic_subscriptions").delete().eq("clinic_id", clinicId);
      await service.from("profiles").delete().eq("clinic_id", clinicId);
      await service.from("clinics").delete().eq("id", clinicId);
    }
  }

  for (const user of users) {
    await service.auth.admin.deleteUser(user.userId).catch(() => undefined);
  }
}
