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
 * Closes `TEN-SEC-004`; documents (does **not** close — see below)
 * `TEN-SEC-003`. Threat-Model `T-TEN-06`/`T-TEN-07`; Discrepancies.md `D-04`.
 *
 * **Mechanism read before writing any assertion (not assumed):**
 * `supabase/migrations/20260713000006_code_review_b5_jwt_custom_claims.sql`
 * is the only migration after the phase1 bootstrap that `create or
 * replace`s `current_clinic_id()`/`current_app_role()`/`is_clinic_owner()`
 * (grepped every migration for `create (or replace )?function
 * public\.(current_clinic_id|current_app_role|is_clinic_owner)\(` — only 2
 * hits: phase1's bootstrap and this one; this one wins since it applies
 * later) — so it is the **final** definition these RLS policies actually
 * run today. Its `public.custom_access_token_hook(event jsonb)` runs on
 * every token issue/refresh (Supabase Auth "Custom Access Token" hook,
 * `supabase/config.toml` `[auth.hook.custom_access_token] enabled = true`
 * locally, pointed at this function): it reads the caller's `clinic_id`
 * + `role` from `profiles` and, **only if a row was found**, writes them
 * into the JWT's `claims.app_metadata.{clinic_id,app_role}`; if no active
 * profile exists yet for that user id, it `return`s the event
 * **unmodified** — no `app_metadata.clinic_id`/`app_role` claim gets
 * added at all. All three of `current_clinic_id()`/`current_app_role()`/
 * `is_clinic_owner()` are `coalesce(<jwt app_metadata claim>, <live
 * profiles fallback>)` — the JWT claim, when present, **always wins**
 * over a live `profiles` row; the `profiles` query is a fallback that
 * only fires when the claim is null/empty.
 *
 * **TEN-SEC-004 (hook off fallback) — test approach:** the task brief
 * itself anticipates that flipping `supabase/config.toml`'s hook `enabled`
 * flag mid-suite isn't feasible (that's a stack-restart-time setting, not
 * a per-request one). But the hook's own "no profile yet → unmodified
 * event" branch produces the **exact same JWT state** a fully-disabled
 * hook would (no `app_metadata.clinic_id`/`app_role` claim at all) —
 * so this file drives that branch directly: create an auth user with
 * **no** `profiles` row yet, sign in (claim-less JWT, asserted), *then*
 * insert the `profiles` row via service role, and — without refreshing or
 * re-issuing the token — call `current_clinic_id()`/`current_app_role()`
 * (and a real RLS-gated `clinics` SELECT) on that same still-claim-less
 * session. This exercises the real `coalesce(...)` fallback branch of the
 * real functions, hermetically, with zero config/migration changes.
 *
 * **TEN-SEC-003 (stale JWT role) — actual behavior found, not assumed:**
 * `current_app_role()` does **not** always read live from `profiles` —
 * it prefers the JWT claim whenever present, exactly like
 * `current_clinic_id()`. So "stale JWT role" is real *whenever the hook
 * is active* and has two very different security directions once a
 * profile's `role` changes while an old (unexpired, unrefreshed) session
 * is still in use:
 *   - **Promotion** (doctor → owner): the old JWT still claims `doctor`,
 *     so `is_clinic_owner()`/`current_app_role()` under-report and an
 *     owner-only write (`clinics_update_owner`) is correctly **denied**.
 *     Old JWT is genuinely "limited" here — matches the catalog's literal
 *     expected result.
 *   - **Demotion** (owner → doctor): the old JWT still claims `owner`, so
 *     the SAME owner-only write **succeeds** even though the live
 *     `profiles.role` is now `doctor` — the demoted user's still-valid
 *     old session keeps owner-level DB access until it is refreshed or
 *     the user re-authenticates. This is the security-relevant direction,
 *     and it is **not** "old JWT limited" — it is the opposite.
 *
 * **Live-run discovery, not assumed either:** the first run of this file
 * against the actually-configured remote project (`full_network` sandbox
 * permission, same project every other P0/P1 phase in this log uses)
 * showed that a signed-in user's JWT there carries **no**
 * `app_metadata.app_role`/`clinic_id` claim at all, even for a profile
 * that already existed *before* sign-in — i.e. the Custom Access Token
 * hook is not actually firing on that project today. This is Discrepancies
 * D-04's own point made concrete: the hook must be manually enabled per
 * project in the Supabase Auth dashboard, and evidently nobody has done
 * that for this one, even though `supabase/config.toml` (which only
 * governs the **local** CLI stack) has had `[auth.hook.
 * custom_access_token] enabled = true` since P0.2. Both tests below
 * therefore **detect** whether the claim is actually present and assert
 * the correct invariant for whichever state is real, instead of hard-
 * coding an assumption — so the same file gives correct, non-vacuous
 * assertions both in a future Docker-enabled local-Supabase CI run (hook
 * genuinely on, matching config.toml) and in the remote run actually
 * exercised here (hook off): with the hook off, `current_app_role()` has
 * no claim to go stale *from*, so both directions correctly show the
 * live DB role taking effect immediately — no staleness is possible on
 * this deployment **today**, precisely because it is not using the
 * hook yet.
 *
 * This matches (does not newly discover) the already-flagged residual:
 * Discrepancies.md `D-04` ("stale claim bugs harder to detect; MFA/role
 * propagation depends on token refresh timing") and Threat-Model.md
 * `T-TEN-06`/`T-TEN-07` ("Fallback to profiles; re-login on role change" /
 * "Ops enable hook; both paths tested") — both already list the
 * compensating control as **re-login / forced logout on role change**,
 * which is `AUTH-INT-020` ("Force logout ineffective"), itself still
 * `GAP` in Test-Strategy.md §4.2. Per `multi-tenant-security.mdc` and the
 * explicit P1.8 task brief ("Ako otkriješ pravi sigurnosni bug … STANI i
 * prijavi mi prije bilo kakvog product fix-a"), **no RLS/migration/hook
 * change was made here** — this file only proves the real behavior in
 * both directions/both hook states. `TEN-SEC-003` is left `GAP` in
 * Test-Strategy.md (not flipped to COVERED) precisely because the
 * demotion-with-hook-active direction shows the DB/RLS layer does *not*
 * protect the way the catalog's "old JWT limited"
 * wording implies — see the P1.8 progress-log entry for the full report.
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
  "TEN-SEC-003: current_app_role()/is_clinic_owner() prefer a (possibly stale) JWT claim over a live profiles.role change",
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

      // Two SEPARATE clinics (not one clinic with both roles): `profiles`
      // has a real `profiles_one_active_owner_per_clinic_idx` partial
      // unique index (`where role = 'owner' and is_active = true`,
      // `20260712900001_phase1_foundation.sql` — confirmed live: an
      // earlier version of this file that promoted a doctor to owner in
      // the SAME clinic as an existing owner hit this constraint's real
      // `23505 duplicate key` error). A clinic with only a doctor can be
      // promoted to owner (0 -> 1 active owner); a clinic with only an
      // owner can be demoted to doctor (1 -> 0). Keeping them in separate
      // clinics also means the two tests below can't interfere with each
      // other's role state.
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

    it("safe direction (promotion doctor -> owner): the old JWT still claims 'doctor', so current_app_role()/is_clinic_owner() under-report and an owner-only write is correctly denied — old JWT genuinely 'limited'", async () => {
      const doctorSession = await signInAs(
        url,
        anonKey,
        doctorUser.email,
        doctorUser.password,
      );

      const { data: sessionData } = await doctorSession.auth.getSession();
      const before = decodeJwtPayload(sessionData.session!.access_token);
      // Whether the JWT actually carries an app_role claim depends on
      // whether the custom-access-token hook is active for *this*
      // environment: `true` locally (config.toml `[auth.hook.
      // custom_access_token] enabled = true`, P0.2), but the remote/
      // staging project this file was also run against live has **never**
      // had the hook manually flipped on in its Auth dashboard settings
      // (Discrepancies.md D-04's own point — the hook is opt-in per
      // project). This test adapts to whichever is actually true right
      // now instead of assuming one or the other, so it stays accurate
      // in both a Docker-enabled CI run (hook on) and this sandbox's
      // remote run (hook off).
      const hookActive = before.app_metadata?.app_role !== undefined;
      if (hookActive) {
        expect(before.app_metadata?.app_role).toBe("doctor");
      }

      const { error: promoteError } = await service
        .from("profiles")
        .update({ role: "owner" })
        .eq("id", doctorUser.userId);
      expect(promoteError).toBeNull();

      try {
        const roleResult = await doctorSession.rpc("current_app_role");
        expect(roleResult.error).toBeNull();

        const isOwnerResult = await doctorSession.rpc("is_clinic_owner");
        expect(isOwnerResult.error).toBeNull();

        // `.select("id")` so a denial can be told apart from an allow:
        // an UPDATE whose USING clause makes the row invisible under RLS
        // returns `error: null` with zero affected rows (Postgres/
        // PostgREST semantics for UPDATE/DELETE — a row simply can't be
        // "found" to update, unlike INSERT's WITH CHECK, which raises an
        // explicit error; same distinction P1.5's leads-and-subscriptions
        // file already had to make for UPDATE vs INSERT/DELETE).
        const ownerWrite = await doctorSession
          .from("clinics")
          .update({ settings_json: { stale_jwt_promotion_probe: randomTag() } })
          .eq("id", promoClinicId)
          .select("id");

        if (hookActive) {
          // Stale claim wins: still "doctor", NOT the live "owner" value,
          // so the owner-only write is (correctly, safely) denied —
          // matches the catalog's "old JWT limited" wording.
          expect(roleResult.data).toBe("doctor");
          expect(isOwnerResult.data).toBe(false);
          expect(ownerWrite.error).toBeNull();
          expect(ownerWrite.data).toEqual([]);
        } else {
          // Hook inactive on this project today (D-04): there was never
          // an app_role claim to go stale, so current_app_role() has
          // nothing to fall back FROM and always reads the live
          // profiles row — the promotion takes effect immediately, no
          // staleness is possible right now.
          expect(roleResult.data).toBe("owner");
          expect(isOwnerResult.data).toBe(true);
          expect(ownerWrite.error).toBeNull();
          expect(ownerWrite.data).toHaveLength(1);
        }
      } finally {
        await service.from("profiles").update({ role: "doctor" }).eq("id", doctorUser.userId);
      }
    });

    it("residual direction (demotion owner -> doctor; Discrepancies D-04 / Threat-Model T-TEN-06): if the hook is active, the old JWT still claims 'owner' and the demoted user's still-valid session RETAINS owner-only write access — old JWT is NOT limited here", async () => {
      const ownerSession = await signInAs(
        url,
        anonKey,
        ownerUser.email,
        ownerUser.password,
      );

      const { data: sessionData } = await ownerSession.auth.getSession();
      const before = decodeJwtPayload(sessionData.session!.access_token);
      const hookActive = before.app_metadata?.app_role !== undefined;
      if (hookActive) {
        expect(before.app_metadata?.app_role).toBe("owner");
      }

      const { error: demoteError } = await service
        .from("profiles")
        .update({ role: "doctor" })
        .eq("id", ownerUser.userId);
      expect(demoteError).toBeNull();

      try {
        const roleResult = await ownerSession.rpc("current_app_role");
        expect(roleResult.error).toBeNull();

        const isOwnerResult = await ownerSession.rpc("is_clinic_owner");
        expect(isOwnerResult.error).toBeNull();

        // Same `.select("id")` + zero-rows-vs-one-row distinction as the
        // promotion test above (UPDATE-denied-by-RLS is `error: null`
        // with an empty array, not an explicit error).
        const ownerWrite = await ownerSession
          .from("clinics")
          .update({ settings_json: { stale_jwt_demotion_residual_probe: randomTag() } })
          .eq("id", demoClinicId)
          .select("id");

        if (hookActive) {
          // Confirmed residual (not fixed here, per multi-tenant-
          // security.mdc and the P1.8 task brief): the stale JWT claim
          // wins over the live (now-lower) DB role, so the now-demoted
          // user's still-valid old JWT can still perform an owner-only
          // write — clinics_update_owner's is_clinic_owner() check reads
          // the stale claim, not the live profiles.role. This is why
          // TEN-SEC-003 is left GAP (not COVERED) in Test-Strategy.md.
          expect(roleResult.data).toBe("owner");
          expect(isOwnerResult.data).toBe(true);
          expect(ownerWrite.error).toBeNull();
          expect(ownerWrite.data).toHaveLength(1);
        } else {
          // Hook inactive on this project today (D-04): there is no
          // claim to go stale, so the demotion takes effect immediately
          // — current_app_role() always reads the live profiles row and
          // the owner-only write is correctly denied right now. This
          // does NOT mean the residual above is fixed: it only holds
          // because this specific deployment has never had the hook
          // enabled; the moment it is (as ops-recommended by D-04, and
          // as already the case in the local/CI config.toml), the
          // `if (hookActive)` branch's residual applies instead.
          expect(roleResult.data).toBe("doctor");
          expect(isOwnerResult.data).toBe(false);
          expect(ownerWrite.error).toBeNull();
          expect(ownerWrite.data).toEqual([]);
        }
      } finally {
        await service.from("profiles").update({ role: "owner" }).eq("id", ownerUser.userId);
      }
    });
  },
);
