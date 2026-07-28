import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  signInAs,
  type ClinicWithRoles,
  type DbClient,
} from "@/lib/security/factories";

/**
 * P5.7 (docs/QA/Implementation-Plan.md): lockout owner notification.
 * Closes `AUTH-INT-002` / Discrepancy **D-06** / D13 / Threat-Model `T-AUTH-01`.
 *
 * **Product decision (2026-07-28):** MVP owner “notification” on lockout is the
 * `audit_events` row `auth.login_lockout` (owner-only Audit UI). Push email /
 * in-app bell (§6.16) deferred until the notification center ships — not a
 * silent gap: PRD D13 / §8.1 aligned to audit.
 *
 * Mechanism (grepped): `record_failed_login` after 5 fails sets `locked_until`
 * + inserts audit (migration `20260713000004_code_review_b2_login_lockout.sql`).
 * `loginAction` calls the RPC on bad password; this INT asserts the **owner
 * visibility** half that `AUTH-DB-001` (service-role) does not.
 *
 * Pattern: **P1.4** RPC + owner JWT SELECT (no SA mock — boundary is DB/RLS).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("AUTH-INT-002 lockout owner notify (audit)", () => {
  if (!env) return;

  const { url, anonKey, serviceKey } = env;
  let service: DbClient;
  let clinic: ClinicWithRoles | null = null;

  beforeAll(async () => {
    service = createSupabaseClient(url, serviceKey);
    clinic = await createClinicWithRoles(service, {
      clinicName: `AUTH-INT-002 ${randomTag()}`,
      roles: ["owner", "doctor"],
      planCode: "starter",
    });
  }, 60_000);

  afterAll(async () => {
    if (clinic) await cleanupClinics(service, clinic.users);
  }, 60_000);

  it("5 failed logins → auth.login_lockout audit readable by owner JWT", async () => {
    const owner = clinic!.byRole.owner!;
    const doctor = clinic!.byRole.doctor!;
    const anon = createSupabaseClient(url, anonKey);

    for (let i = 0; i < 5; i += 1) {
      const { error } = await anon.rpc("record_failed_login", {
        p_email: doctor.email,
      });
      expect(error).toBeNull();
    }

    const { data: profile } = await service
      .from("profiles")
      .select("failed_login_count, locked_until")
      .eq("id", doctor.userId)
      .single();
    expect(profile?.failed_login_count).toBe(5);
    expect(profile?.locked_until).not.toBeNull();

    const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    const { data: ownerAudit, error: ownerErr } = await ownerClient
      .from("audit_events")
      .select("id, event_name, payload_json")
      .eq("clinic_id", clinic!.clinicId)
      .eq("event_name", "auth.login_lockout");

    expect(ownerErr).toBeNull();
    expect(ownerAudit).toHaveLength(1);
    expect(ownerAudit?.[0]?.payload_json).toMatchObject({
      profile_id: doctor.userId,
      failed_login_count: 5,
    });

    // Doctor cannot see the security audit (owner-only Audit UI / RBAC-RLS-005).
    const doctorClient = await signInAs(
      url,
      anonKey,
      doctor.email,
      doctor.password,
    );
    const { data: doctorAudit, error: doctorErr } = await doctorClient
      .from("audit_events")
      .select("id")
      .eq("clinic_id", clinic!.clinicId)
      .eq("event_name", "auth.login_lockout");

    expect(doctorErr).toBeNull();
    expect(doctorAudit ?? []).toHaveLength(0);
  }, 30_000);
});
