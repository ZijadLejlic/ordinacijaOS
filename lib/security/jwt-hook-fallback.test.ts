import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createAuthUser,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  resolvePlanId,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P1.8 (docs/QA/Implementation-Plan.md): JWT custom-claims hook on vs off.
 * Closes `TEN-SEC-004` + `TEN-SEC-003` (hardened P6b.8).
 * Threat-Model `T-TEN-06`/`T-TEN-07`; Discrepancies.md `D-04`.
 *
 * **Mechanism read before writing any assertion (not assumed):**
 * `supabase/migrations/20260713000006_code_review_b5_jwt_custom_claims.sql`
 * introduced JWT-first `current_clinic_id()`/`current_app_role()`/
 * `is_clinic_owner()` + `custom_access_token_hook`. Hook stamps
 * `app_metadata.{clinic_id,app_role}` from live profiles on token issue.
 *
 * **TEN-SEC-004 (hook off fallback):** unchanged — claim-less JWT (no
 * profile at sign-in) still resolves via profiles after row insert.
 *
 * **TEN-SEC-003 (stale JWT role) — P6b.8 product fix:**
 * Migration `20260728040000_fix_stale_jwt_role_prefer_profiles.sql`
 * flips **role** helpers to profiles-first:
 *   `coalesce(live profiles.role, jwt app_role)`.
 * Demotion (owner→doctor) with a still-valid JWT that claims `owner`
 * now denies owner-only writes immediately. Promotion also takes effect
 * immediately. `current_clinic_id()` stays JWT-first (D7: clinic_id does
 * not move). Revoking `auth.sessions` alone cannot close demotion while
 * the access token remains valid until `jwt_expiry`.
 *
 * Tests still detect whether the hook stamped a claim (remote Free may
 * leave hook off — D-04 ACCEPTED) and assert the post-fix invariant in
 * both environments: after a live role change, helpers follow `profiles`.
 */

function decodeJwtPayload(accessToken: string): {
  aal?: string;
  app_metadata?: { clinic_id?: string; app_role?: string };
} {
  const payload = accessToken.split(".")[1];
  if (!payload) {
    throw new Error("malformed access token: no JWT payload segment");
  }
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as {
    aal?: string;
    app_metadata?: { clinic_id?: string; app_role?: string };
  };
}

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity(
  "TEN-SEC-004: current_clinic_id()/current_app_role() fall back to profiles when the JWT app_metadata claim is absent",
  () => {
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;

    let clinicId: string;
    let userId: string;
    let email: string;
    let password: string;
    let session: DbClient;
    const created: TestUser[] = [];

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      const tag = randomTag();
      const planId = await resolvePlanId(service, "professional");
      const { data: clinic, error: clinicError } = await service
        .from("clinics")
        .insert({
          name: `JWT Fallback ${tag}`,
          plan_id: planId,
          trial_ends_at: "2026-12-31T23:59:59+00:00",
        })
        .select("id")
        .single();
      if (clinicError || !clinic) {
        throw new Error(clinicError?.message ?? "clinic insert failed");
      }
      clinicId = clinic.id;

      email = `jwt-fallback-doctor-${tag}@ordinacijaos.test`;
      password = `Test-${tag}!Aa1`;
      const user = await createAuthUser(service, email, password);
      userId = user.id;
      created.push({
        clinicId,
        userId,
        email,
        password,
        role: "doctor",
        fullName: `JWT Fallback Doctor ${tag}`,
      });

      // Deliberately no `profiles` row yet: signing in now exercises
      // custom_access_token_hook's "no profile found -> return event
      // unmodified" early-return branch.
      session = await signInAs(url, anonKey, email, password);
    }, 60_000);

    afterAll(async () => {
      await cleanupClinics(service, created);
    }, 60_000);

    it("precondition: a freshly signed-in user with no profile row yet gets a JWT with no app_metadata.clinic_id/app_role claim", async () => {
      const { data, error } = await session.auth.getSession();
      expect(error).toBeNull();
      const payload = decodeJwtPayload(data.session!.access_token);
      expect(payload.app_metadata?.clinic_id).toBeUndefined();
      expect(payload.app_metadata?.app_role).toBeUndefined();
    });

    it("precondition: current_clinic_id()/current_app_role() return null before any profile exists (fail-safe, not fail-open)", async () => {
      const clinicIdResult = await session.rpc("current_clinic_id");
      expect(clinicIdResult.error).toBeNull();
      expect(clinicIdResult.data).toBeNull();

      const roleResult = await session.rpc("current_app_role");
      expect(roleResult.error).toBeNull();
      expect(roleResult.data).toBeNull();
    });

    it("TEN-SEC-004: after the profile is created, the SAME still-claim-less JWT resolves current_clinic_id()/current_app_role() correctly via the profiles fallback", async () => {
      const { error: profileError } = await service.from("profiles").insert({
        id: userId,
        clinic_id: clinicId,
        role: "doctor",
        full_name: "JWT Fallback Doctor",
        is_active: true,
      });
      expect(profileError).toBeNull();

      // Confirm this is really the same, still-unrefreshed access token
      // from beforeAll (no re-login / no token refresh happened).
      const { data: sessionData } = await session.auth.getSession();
      const payload = decodeJwtPayload(sessionData.session!.access_token);
      expect(payload.app_metadata?.clinic_id).toBeUndefined();
      expect(payload.app_metadata?.app_role).toBeUndefined();

      const clinicIdResult = await session.rpc("current_clinic_id");
      expect(clinicIdResult.error).toBeNull();
      expect(clinicIdResult.data).toBe(clinicId);

      const roleResult = await session.rpc("current_app_role");
      expect(roleResult.error).toBeNull();
      expect(roleResult.data).toBe("doctor");
    });

    it("TEN-SEC-004: a real RLS-gated table read (not just the raw function) succeeds via the same fallback path", async () => {
      const { data, error } = await session
        .from("clinics")
        .select("id")
        .eq("id", clinicId)
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBe(clinicId);
    });
  },
);

describeSecurity(
  "TEN-SEC-003: after role change, current_app_role()/is_clinic_owner() follow live profiles (not stale JWT)",
  () => {
    let url: string;
    let anonKey: string;
    let serviceKey: string;
    let service: DbClient;

    let promoClinicId: string;
    let doctorUser: TestUser;
    let demoClinicId: string;
    let ownerUser: TestUser;
    const created: TestUser[] = [];

    beforeAll(async () => {
      ({ url, anonKey, serviceKey } = env!);
      service = createSupabaseClient(url, serviceKey);

      // Two SEPARATE clinics: partial unique index
      // `profiles_one_active_owner_per_clinic_idx` (phase1) — promote
      // doctor→owner and demote owner→doctor in the same clinic collide.
      const promoClinic = await createClinicWithRoles(service, {
        roles: ["doctor"],
        clinicName: `Stale JWT Role Promo ${randomTag()}`,
        emailPrefix: "stale-role-promo",
      });
      promoClinicId = promoClinic.clinicId;
      doctorUser = promoClinic.byRole.doctor!;
      created.push(...promoClinic.users);

      const demoClinic = await createClinicWithRoles(service, {
        roles: ["owner"],
        clinicName: `Stale JWT Role Demo ${randomTag()}`,
        emailPrefix: "stale-role-demo",
      });
      demoClinicId = demoClinic.clinicId;
      ownerUser = demoClinic.byRole.owner!;
      created.push(...demoClinic.users);
    }, 60_000);

    afterAll(async () => {
      await cleanupClinics(service, created);
    }, 60_000);

    it("TEN-SEC-003 promotion doctor→owner: live profiles wins (owner write allowed even if JWT still claims doctor)", async () => {
      const doctorSession = await signInAs(
        url,
        anonKey,
        doctorUser.email,
        doctorUser.password,
      );

      const { data: sessionData } = await doctorSession.auth.getSession();
      const before = decodeJwtPayload(sessionData.session!.access_token);
      // Hook may be off on hosted Free (D-04); claim presence is informational.
      if (before.app_metadata?.app_role !== undefined) {
        expect(before.app_metadata.app_role).toBe("doctor");
      }

      const { error: promoteError } = await service
        .from("profiles")
        .update({ role: "owner" })
        .eq("id", doctorUser.userId);
      expect(promoteError).toBeNull();

      try {
        const roleResult = await doctorSession.rpc("current_app_role");
        expect(roleResult.error).toBeNull();
        expect(roleResult.data).toBe("owner");

        const isOwnerResult = await doctorSession.rpc("is_clinic_owner");
        expect(isOwnerResult.error).toBeNull();
        expect(isOwnerResult.data).toBe(true);

        // UPDATE denied by RLS → error null + empty data (PostgREST semantics).
        const ownerWrite = await doctorSession
          .from("clinics")
          .update({ settings_json: { stale_jwt_promotion_probe: randomTag() } })
          .eq("id", promoClinicId)
          .select("id");
        expect(ownerWrite.error).toBeNull();
        expect(ownerWrite.data).toHaveLength(1);

        // If hook stamped a claim, prove the access token was NOT refreshed
        // (stale claim still doctor) while helpers followed live profiles.
        const { data: afterSession } = await doctorSession.auth.getSession();
        const after = decodeJwtPayload(afterSession.session!.access_token);
        if (before.app_metadata?.app_role !== undefined) {
          expect(after.app_metadata?.app_role).toBe("doctor");
        }
      } finally {
        await service
          .from("profiles")
          .update({ role: "doctor" })
          .eq("id", doctorUser.userId);
      }
    });

    it("TEN-SEC-003 demotion owner→doctor: live profiles wins (owner write denied even if JWT still claims owner)", async () => {
      const ownerSession = await signInAs(
        url,
        anonKey,
        ownerUser.email,
        ownerUser.password,
      );

      const { data: sessionData } = await ownerSession.auth.getSession();
      const before = decodeJwtPayload(sessionData.session!.access_token);
      if (before.app_metadata?.app_role !== undefined) {
        expect(before.app_metadata.app_role).toBe("owner");
      }

      const { error: demoteError } = await service
        .from("profiles")
        .update({ role: "doctor" })
        .eq("id", ownerUser.userId);
      expect(demoteError).toBeNull();

      try {
        const roleResult = await ownerSession.rpc("current_app_role");
        expect(roleResult.error).toBeNull();
        expect(roleResult.data).toBe("doctor");

        const isOwnerResult = await ownerSession.rpc("is_clinic_owner");
        expect(isOwnerResult.error).toBeNull();
        expect(isOwnerResult.data).toBe(false);

        const ownerWrite = await ownerSession
          .from("clinics")
          .update({
            settings_json: { stale_jwt_demotion_probe: randomTag() },
          })
          .eq("id", demoClinicId)
          .select("id");
        expect(ownerWrite.error).toBeNull();
        expect(ownerWrite.data).toEqual([]);

        const { data: afterSession } = await ownerSession.auth.getSession();
        const after = decodeJwtPayload(afterSession.session!.access_token);
        if (before.app_metadata?.app_role !== undefined) {
          expect(after.app_metadata?.app_role).toBe("owner");
        }
      } finally {
        await service
          .from("profiles")
          .update({ role: "owner" })
          .eq("id", ownerUser.userId);
      }
    });
  },
);
