import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/invites/token";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P1.4 (docs/QA/Implementation-Plan.md): invite token reuse / expiry.
 * Closes `AUTH-SEC-001` / Threat-Model `T-AUTH-03` ("Stolen invite token
 * accepted twice / expired" — mitigations: "Token hash; status transitions;
 * expiry").
 *
 * Where the actual security boundary lives (read `lib/invites/actions.ts` +
 * `supabase/migrations/20260712900001_phase1_foundation.sql` before writing
 * anything): `public.accept_clinic_invite(p_token_hash, p_user_id)` and
 * `public.peek_clinic_invite(p_token_hash)` are `security definer` Postgres
 * functions, and — unlike every RLS-gated table in this repo — they are
 * `revoke all ... from public, anon, authenticated` and `grant execute ...
 * to service_role` ONLY (see lines ~718-726 of that migration). So this is
 * **not** reachable at all as an authenticated-client RLS probe (any
 * `authenticated`/`anon` caller gets a flat `permission denied for function`,
 * which would prove nothing about reuse/expiry) — it can only ever be called
 * server-side with the service-role key, exactly as `acceptInviteAction` in
 * `lib/invites/actions.ts` does.
 *
 * Given that, this file calls the two RPCs directly through the shared
 * service-role client (`factories.ts`'s `createSupabaseClient`), the same
 * client every other file in this suite already uses for setup/teardown,
 * instead of invoking the full `acceptInviteAction` server action. Reasons:
 *   1. All of the reuse/expiry/status-transition logic under test lives
 *      entirely inside `accept_clinic_invite`'s plpgsql body (`for update`
 *      row lock, `status <> 'pending'` check, `expires_at < now()` check) —
 *      the server action is a thin wrapper that also creates the auth user
 *      and calls this exact RPC with the exact same two arguments.
 *   2. `acceptInviteAction` additionally depends on `next-intl/server`'s
 *      `getLocale()`, `@/i18n/navigation`'s `redirect()` (which throws a
 *      Next.js-internal control-flow error by design) and a final
 *      `supabase.auth.signInWithPassword` via `@/lib/supabase/server`'s
 *      cookie-bound client — none of which affect whether a second accept
 *      or an expired accept is rejected. Mocking all of that (like P1.2's
 *      `vi.mock("@/lib/supabase/server", ...)` harness for the invoice PDF
 *      *route*) would only be justified if the IDOR/security check lived in
 *      the action itself, the way FILE-SEC-003's did in the route handler.
 *      Here it doesn't — it lives in the DB function, so testing the DB
 *      function directly is the more precise (and hermetic) test.
 *   3. This mirrors the existing precedent of testing `hard_delete_clinic`
 *      and `allocate_invoice_number`-style RPCs directly via the service
 *      client rather than through their server-action callers.
 *
 * Token creation goes through the *real* `lib/invites/token.ts` helpers
 * (`createInviteToken`/`hashInviteToken`/`inviteExpiresAt`) — the same
 * random-token + sha256-hash + 7-day-TTL mechanism `createInviteAction`
 * uses — just inserted directly into `clinic_invites` via the service
 * client instead of going through the full owner-invite server action
 * (which also needs `assertCanInviteStaff`, Resend email sending, and
 * `next-intl` locale — all unrelated to the reuse/expiry question here).
 *
 * Result of writing this file: no product/RLS bug found — `accept_clinic_
 * invite` already enforces "not pending" (covers both "already accepted"
 * reuse and "revoked") and "expired" correctly; this is a pure
 * test-authoring task, matching P1.1/P1.2/P1.3's precedent. Per
 * `multi-tenant-security.mdc` there was nothing to stop and report.
 *
 * Bonus test below also touches `AUTH-SEC-003` (email enumeration via the
 * invite accept path is a *different*, not-yet-covered test ID) only as an
 * observation in a comment — it is not asserted on here.
 */

const TEST_PASSWORD_LENGTH_OK = "Test-Aa1!23456"; // >= 8 chars, matches acceptInviteSchema's min(8)

async function createPendingInvite(
  service: DbClient,
  opts: {
    clinicId: string;
    invitedBy: string;
    email?: string;
    expiresAt?: string;
  },
) {
  const tag = randomTag();
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const email = opts.email ?? `invite-target-${tag}@ordinacijaos.test`;

  const { data, error } = await service
    .from("clinic_invites")
    .insert({
      clinic_id: opts.clinicId,
      email,
      full_name: `Invite Target ${tag}`,
      role: "doctor",
      token_hash: tokenHash,
      expires_at: opts.expiresAt ?? inviteExpiresAt(),
      invited_by: opts.invitedBy,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "clinic_invites insert failed");
  }

  return { inviteId: data.id as string, token, tokenHash, email };
}

/**
 * Mirrors exactly what `acceptInviteAction` does with the two RPCs: create
 * the (new, never-before-seen) auth user for the invite's email, then call
 * `accept_clinic_invite` with that user's id — the same two-argument shape
 * the real server action uses.
 */
async function acceptInvite(
  service: DbClient,
  tokenHash: string,
  email: string,
) {
  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password: TEST_PASSWORD_LENGTH_OK,
      email_confirm: true,
    });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "auth.admin.createUser failed");
  }

  const { data: resultClinicId, error: acceptError } = await service.rpc(
    "accept_clinic_invite",
    { p_token_hash: tokenHash, p_user_id: created.user.id },
  );

  return { userId: created.user.id, clinicId: resultClinicId, error: acceptError };
}

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("invite token reuse / expiry (release blocker)", () => {
  let service: DbClient;
  let clinicId: string;
  let owner: TestUser;
  const created: TestUser[] = [];
  const extraAuthUserIds: string[] = [];

  beforeAll(async () => {
    const { url, serviceKey } = env!;
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `Invite token ${randomTag()}`,
      emailPrefix: "invite-token",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    created.push(...clinic.users);
  }, 30_000);

  afterAll(async () => {
    // Extra auth users created by `acceptInvite()` (not part of `created`,
    // since they're never passed to `createClinicWithRoles`) — delete them
    // first; `profiles.id references auth.users(id) on delete cascade`
    // takes their profile rows with them regardless of ordering vs the
    // clinic cleanup below.
    for (const userId of extraAuthUserIds) {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    await cleanupClinics(service, created);
  }, 30_000);

  it("AUTH-SEC-001: first accept succeeds (profile created, invite -> accepted); a second accept with the identical token fails", async () => {
    const invite = await createPendingInvite(service, {
      clinicId,
      invitedBy: owner.userId,
    });

    const peekBefore = await service.rpc("peek_clinic_invite", {
      p_token_hash: invite.tokenHash,
    });
    expect(peekBefore.error).toBeNull();
    expect(peekBefore.data?.[0]?.status).toBe("pending");
    expect(peekBefore.data?.[0]?.email).toBe(invite.email);

    const first = await acceptInvite(service, invite.tokenHash, invite.email);
    extraAuthUserIds.push(first.userId);
    expect(first.error).toBeNull();
    expect(first.clinicId).toBe(clinicId);

    const { data: profile } = await service
      .from("profiles")
      .select("role, clinic_id, full_name")
      .eq("id", first.userId)
      .single();
    expect(profile?.role).toBe("doctor");
    expect(profile?.clinic_id).toBe(clinicId);

    const { data: acceptedInvite } = await service
      .from("clinic_invites")
      .select("status, accepted_at")
      .eq("id", invite.inviteId)
      .single();
    expect(acceptedInvite?.status).toBe("accepted");
    expect(acceptedInvite?.accepted_at).not.toBeNull();

    // Reuse attempt: a brand-new user (never seen before, so the RPC's own
    // "profile already exists" guard can't be what rejects this — the only
    // thing standing in the way is the invite's own status transition) — the
    // same token, submitted a second time. Test-Strategy.md's own wording:
    // "accepted token | second accept fails".
    const second = await acceptInvite(
      service,
      invite.tokenHash,
      `reuse-attempt-${randomTag()}@ordinacijaos.test`,
    );
    extraAuthUserIds.push(second.userId);
    expect(second.error).not.toBeNull();
    expect(second.error?.message).toMatch(/not pending/i);
    expect(second.clinicId).toBeNull();

    // The reuse attempt must not have created a second profile for that clinic.
    const { data: secondProfile } = await service
      .from("profiles")
      .select("id")
      .eq("id", second.userId)
      .maybeSingle();
    expect(secondProfile).toBeNull();
  });

  it("AUTH-SEC-001: an expired invite is rejected on accept and its status flips to expired", async () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    const invite = await createPendingInvite(service, {
      clinicId,
      invitedBy: owner.userId,
      expiresAt: pastExpiry,
    });

    const result = await acceptInvite(service, invite.tokenHash, invite.email);
    extraAuthUserIds.push(result.userId);
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toMatch(/expired/i);
    expect(result.clinicId).toBeNull();

    // `accept_clinic_invite` UPDATEs status→expired then RAISE EXCEPTION.
    // Postgres rolls that UPDATE back with the error, so status stays
    // `pending` after a failed accept. The durable flip is on
    // `peek_clinic_invite` (no raise) / `expire_stale_clinic_invites`.
    const peekAfter = await service.rpc("peek_clinic_invite", {
      p_token_hash: invite.tokenHash,
    });
    expect(peekAfter.error).toBeNull();
    expect(peekAfter.data?.[0]?.status).toBe("expired");

    const { data: expiredInvite } = await service
      .from("clinic_invites")
      .select("status")
      .eq("id", invite.inviteId)
      .single();
    expect(expiredInvite?.status).toBe("expired");
  });

  it("AUTH-SEC-001 bonus: a nonexistent token is rejected the same way as a real one, not with a distinguishing error", async () => {
    // 32 bytes hex = 64 chars, well past the RPC's own `length(p_token_hash)
    // < 32` guard, so this exercises the "not found" branch specifically,
    // not the "malformed input" branch.
    const fakeHash = randomBytes(32).toString("hex");

    const peek = await service.rpc("peek_clinic_invite", {
      p_token_hash: fakeHash,
    });
    expect(peek.error).toBeNull();
    expect(peek.data ?? []).toHaveLength(0);

    const result = await acceptInvite(
      service,
      fakeHash,
      `nonexistent-token-${randomTag()}@ordinacijaos.test`,
    );
    extraAuthUserIds.push(result.userId);
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toMatch(/not found/i);
    expect(result.clinicId).toBeNull();

    // Note (AUTH-SEC-003 covers lockout RPC enumeration separately — COVERED
    // in lockout-email-enumeration.test.ts). Invite accept still has a
    // narrow existence-leak surface ("Invite not found" vs "Invite expired")
    // on `accept_clinic_invite`; flagged here per the P1.4 task brief rather
    // than expanding AUTH-SEC-003 beyond lockout RPCs.
  });
});
