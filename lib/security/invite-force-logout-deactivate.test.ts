import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertCanInviteStaff } from "@/lib/entitlements/limits";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P3.4 (docs/QA/Implementation-Plan.md): invite seat SA gate + force logout
 * + owner deactivate.
 * Closes `AUTH-INT-010`, `AUTH-INT-020` / Threat-Model `T-AUTH-03` (SA half;
 * token reuse/expiry already `AUTH-SEC-001`) / `T-AUTH-05` / BR-A13 / BR-P04.
 * Documents Discrepancies **D-07** (force logout is per-user, not clinic-wide).
 *
 * **Already COVERED elsewhere — do not duplicate:**
 * - `AUTH-SEC-001` invite token reuse/expiry → `invite-token.test.ts`
 * - `PLAN-DB-001` starter user-seat invite limit (DB trigger) →
 *   `tenant-isolation.test.ts`
 * - `AUTH-RLS-002` self-promote → already COVERED
 *
 * **Mechanisms (grepped, not assumed):**
 * - `assertCanInviteStaff` (`lib/entitlements/limits.ts`): counts active
 *   profiles + pending invites vs `plans.limits_json.users`; returns
 *   `{ ok: false, code: "userLimit" }` at/over cap. Called from
 *   `createInviteAction` before insert/email.
 * - `forceLogoutUserAction` / `deactivateUserAction`
 *   (`lib/invites/actions.ts`): `requireOwnerProfile()` then
 *   `createServiceClient().rpc("revoke_user_sessions", { p_user_id })`
 *   (D-22 fix — Admin `signOut` needs a JWT, not a user id). Deactivate
 *   sets `is_active=false` only (D-23 — A1 column GRANT excludes
 *   `updated_at`; trigger fills it). JWT hook / `current_*` helpers filter
 *   `is_active = true` — thin assert here; full hook suite is
 *   `jwt-hook-fallback.test.ts`.
 *
 * Pattern: **P1.6 / P2.8 SA** (`vi.mock` Next + `createServiceClient` with
 * `ws` transport + real actions). No clinic-wide logout invented (D-07).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;
/** Service-role client for SA body (`createServiceClient` mock target). */
let serviceForActions: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeActionClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => serviceForActions,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "bs",
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT unexpected in P3.4");
  },
}));

// After mocks (Vitest hoists `vi.mock`).
import {
  createInviteAction,
  deactivateUserAction,
  forceLogoutUserAction,
} from "@/lib/invites/actions";

describeSecurity("P3.4 invite / force logout / deactivate (AUTH-INT-010/020)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  /** Starter clinic for seat-cap SA gate (users=3). */
  let limitClinicId: string;
  let limitOwner: TestUser;
  let limitOwnerClient: DbClient;

  /** Professional clinic for force-logout / deactivate (room for staff). */
  let staffClinicId: string;
  let staffOwner: TestUser;
  let staffDoctor: TestUser;
  let staffReception: TestUser;
  let staffOwnerClient: DbClient;
  let staffDoctorClient: DbClient;
  let staffReceptionClient: DbClient;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);
    serviceForActions = service;

    const limitClinic = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `Invite Limit SA ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "auth-int-010",
    });
    limitClinicId = limitClinic.clinicId;
    limitOwner = limitClinic.byRole.owner!;
    created.push(...limitClinic.users);
    limitOwnerClient = await signInAs(
      url,
      anonKey,
      limitOwner.email,
      limitOwner.password,
    );

    const staffClinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "reception"],
      clinicName: `Force Logout SA ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "auth-int-020",
    });
    staffClinicId = staffClinic.clinicId;
    staffOwner = staffClinic.byRole.owner!;
    staffDoctor = staffClinic.byRole.doctor!;
    staffReception = staffClinic.byRole.reception!;
    created.push(...staffClinic.users);

    staffOwnerClient = await signInAs(
      url,
      anonKey,
      staffOwner.email,
      staffOwner.password,
    );
    staffDoctorClient = await signInAs(
      url,
      anonKey,
      staffDoctor.email,
      staffDoctor.password,
    );
    staffReceptionClient = await signInAs(
      url,
      anonKey,
      staffReception.email,
      staffReception.password,
    );
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  it("AUTH-INT-010: assertCanInviteStaff allows under starter user cap", async () => {
    const { data: plan, error: planError } = await service
      .from("plans")
      .select("limits_json")
      .eq("code", "starter")
      .single();
    if (planError || !plan) {
      throw new Error(planError?.message ?? "starter plan not found");
    }
    const limitsJson = plan.limits_json;
    const userLimit =
      limitsJson &&
      typeof limitsJson === "object" &&
      !Array.isArray(limitsJson) &&
      typeof limitsJson.users === "number"
        ? limitsJson.users
        : null;
    if (userLimit === null || userLimit < 2) {
      throw new Error(
        "starter plan has no usable numeric users limit — AUTH-INT-010 cannot proceed",
      );
    }

    // Fixture is owner-only (1 seat). Under-cap positive control for the SA gate
    // (beyond PLAN-DB-001 which only probes the DB trigger on insert).
    const check = await assertCanInviteStaff(
      limitOwnerClient,
      limitClinicId,
      "reception",
    );
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.usage.users).toBe(1);
      expect(check.limits.users).toBe(userLimit);
    }
  });

  it("AUTH-INT-010: assertCanInviteStaff + createInviteAction block at user cap", async () => {
    const { data: plan } = await service
      .from("plans")
      .select("limits_json")
      .eq("code", "starter")
      .single();
    const limitsJson = plan?.limits_json;
    const userLimit =
      limitsJson &&
      typeof limitsJson === "object" &&
      !Array.isArray(limitsJson) &&
      typeof limitsJson.users === "number"
        ? limitsJson.users
        : 3;

    // Fill remaining seats with pending invites (counts toward BR-P04 usage).
    const seatsToFill = userLimit - 1; // owner already occupies 1
    for (let i = 0; i < seatsToFill; i += 1) {
      const { error } = await service.from("clinic_invites").insert({
        clinic_id: limitClinicId,
        email: `cap-invite-${randomTag()}-${i}@ordinacijaos.test`,
        full_name: `Cap Invite ${i}`,
        role: "reception",
        token_hash: `${i.toString(16).padStart(64, "c")}`,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        status: "pending",
        invited_by: limitOwner.userId,
      });
      expect(error).toBeNull();
    }

    const check = await assertCanInviteStaff(
      limitOwnerClient,
      limitClinicId,
      "doctor",
    );
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe("userLimit");
      expect(check.usage.users).toBe(userLimit);
    }

    // SA wiring: createInviteAction returns the gate code before email/DB insert.
    activeActionClient = limitOwnerClient;
    const fd = new FormData();
    fd.set("email", `over-cap-${randomTag()}@ordinacijaos.test`);
    fd.set("fullName", "Over Cap");
    fd.set("role", "reception");
    const result = await createInviteAction(null, fd);
    expect(result?.error).toBe("userLimit");
  });

  it("AUTH-INT-020: owner forceLogoutUserAction revokes target sessions (per-user, D-07)", async () => {
    const {
      data: { user: doctorBefore },
      error: doctorBeforeError,
    } = await staffDoctorClient.auth.getUser();
    expect(doctorBeforeError).toBeNull();
    expect(doctorBefore?.id).toBe(staffDoctor.userId);

    activeActionClient = staffOwnerClient;
    const result = await forceLogoutUserAction(staffDoctor.userId);
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("userLoggedOut");

    const { data: audits, error: auditError } = await service
      .from("audit_events")
      .select("event_name, actor_user_id, payload_json")
      .eq("clinic_id", staffClinicId)
      .eq("event_name", "user.force_logout")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(auditError).toBeNull();
    expect(audits?.[0]?.actor_user_id).toBe(staffOwner.userId);
    const payload = audits?.[0]?.payload_json;
    expect(payload && typeof payload === "object" && !Array.isArray(payload)).toBe(
      true,
    );
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      expect(payload.profile_id).toBe(staffDoctor.userId);
    }

    // Refresh must fail once sessions are revoked (access JWT may still
    // decode locally until expiry — GoTrue known residual; catalog
    // "sessions revoked" = refresh / re-issue path).
    const { error: refreshError } =
      await staffDoctorClient.auth.refreshSession();
    expect(refreshError).not.toBeNull();

    // D-07: per-user only — reception session still authenticates.
    const {
      data: { user: receptionAfter },
      error: receptionAfterError,
    } = await staffReceptionClient.auth.getUser();
    expect(receptionAfterError).toBeNull();
    expect(receptionAfter?.id).toBe(staffReception.userId);

    const { data: receptionRefresh, error: receptionRefreshError } =
      await staffReceptionClient.auth.refreshSession();
    expect(receptionRefreshError).toBeNull();
    expect(receptionRefresh.session).not.toBeNull();
  });

  it("AUTH-INT-020: non-owner cannot forceLogoutUserAction", async () => {
    activeActionClient = staffReceptionClient;
    const result = await forceLogoutUserAction(staffDoctor.userId);
    expect(result?.error).toBe("forbidden");
  });

  it("AUTH-INT-020: owner soft-deactivates; sessions revoked; non-owner denied", async () => {
    const receptionClient = await signInAs(
      url,
      anonKey,
      staffReception.email,
      staffReception.password,
    );

    activeActionClient = staffOwnerClient;
    const result = await deactivateUserAction(staffReception.userId);
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe("userDeactivated");

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("is_active")
      .eq("id", staffReception.userId)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.is_active).toBe(false);

    const { data: audits } = await service
      .from("audit_events")
      .select("event_name, actor_user_id, payload_json")
      .eq("clinic_id", staffClinicId)
      .eq("event_name", "user.deactivated")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audits?.[0]?.actor_user_id).toBe(staffOwner.userId);

    const { error: refreshError } = await receptionClient.auth.refreshSession();
    expect(refreshError).not.toBeNull();

    // Thin is_active reference for T-AUTH-05 (not a full JWT-hook re-suite):
    // Auth sign-in is not blocked by profiles.is_active; RLS helpers skip
    // inactive. Assert profile flag + document.
    const inactiveClient = createSupabaseClient(url, anonKey);
    const { error: signInError } = await inactiveClient.auth.signInWithPassword({
      email: staffReception.email,
      password: staffReception.password,
    });
    expect(signInError).toBeNull();

    const doctorAsActor = await signInAs(
      url,
      anonKey,
      staffDoctor.email,
      staffDoctor.password,
    );
    activeActionClient = doctorAsActor;
    const denied = await deactivateUserAction(staffOwner.userId);
    expect(denied?.error).toBe("forbidden");
  });
});
