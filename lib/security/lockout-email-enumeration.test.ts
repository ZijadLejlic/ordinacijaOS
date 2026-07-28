import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
 * P6b — AUTH-SEC-003 (D13 / T-AUTH-07): lockout RPC must not leak email
 * existence via distinct errors for unknown vs known-unlocked addresses.
 *
 * **Mechanism (read, not invented):**
 * `check_login_lockout` / `record_failed_login`
 * (`20260713000004_code_review_b2_login_lockout.sql`):
 *   - unknown email → silent `RETURN` (no exception)
 *   - known unlocked → silent (or increment count)
 *   - known locked → `raise exception 'locked'` (errcode check_violation)
 * SA `loginAction` maps any message containing "locked" → `locked`; auth
 * fail always → `invalidCredentials` (no user-not-found branch).
 *
 * Probe: unknown vs known-unlocked must be indistinguishable on both RPCs.
 * Locked path may return generic `locked` (UX) — assert message has no
 * email and is not a user-not-found variant. Stop-and-report if unknown
 * vs known-unlocked diverge.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("lockout RPC email enumeration (AUTH-SEC-003)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let anon: DbClient;
  let doctor: TestUser;
  const unknownEmail = `no-such-user-${randomTag()}@ordinacijaos.test`;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);
    anon = createSupabaseClient(url, anonKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["doctor"],
      clinicName: `AUTH-SEC-003 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "auth-sec-003",
    });
    doctor = clinic.byRole.doctor!;
    created.push(...clinic.users);

    // Ensure unlocked baseline for the known email.
    await service
      .from("profiles")
      .update({ failed_login_count: 0, locked_until: null })
      .eq("id", doctor.userId);
  }, 120_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  });

  it("AUTH-SEC-003: check_login_lockout unknown ≡ known-unlocked (no error)", async () => {
    const unknown = await anon.rpc("check_login_lockout", {
      p_email: unknownEmail,
    });
    const known = await anon.rpc("check_login_lockout", {
      p_email: doctor.email,
    });

    expect(unknown.error).toBeNull();
    expect(known.error).toBeNull();
  });

  it("AUTH-SEC-003: record_failed_login unknown ≡ known (no error / no user-not-found)", async () => {
    const unknown = await anon.rpc("record_failed_login", {
      p_email: unknownEmail,
    });
    const known = await anon.rpc("record_failed_login", {
      p_email: doctor.email,
    });

    expect(unknown.error).toBeNull();
    expect(known.error).toBeNull();

    // Unknown must not create a profile / bump anything we can observe.
    // Known may increment failed_login_count — that is not an RPC error leak.
    const msg = `${unknown.error?.message ?? ""}${known.error?.message ?? ""}`.toLowerCase();
    expect(msg).not.toMatch(/not found|does not exist|unknown user|no user/);
  });

  it("AUTH-SEC-003: locked path returns generic locked (no email in message)", async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    const { error: lockSetErr } = await service
      .from("profiles")
      .update({ failed_login_count: 5, locked_until: lockedUntil })
      .eq("id", doctor.userId);
    expect(lockSetErr).toBeNull();

    const locked = await anon.rpc("check_login_lockout", {
      p_email: doctor.email,
    });
    expect(locked.error).not.toBeNull();
    const message = (locked.error?.message ?? "").toLowerCase();
    expect(message).toContain("locked");
    expect(message).not.toContain(doctor.email.toLowerCase());
    expect(message).not.toMatch(/not found|does not exist|unknown user/);

    // Control: unknown still silent while a different account is locked.
    const unknown = await anon.rpc("check_login_lockout", {
      p_email: unknownEmail,
    });
    expect(unknown.error).toBeNull();
  });
});
