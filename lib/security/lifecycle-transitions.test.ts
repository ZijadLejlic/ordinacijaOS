import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createSupabaseClient,
  signInAs,
  type ClinicWithRoles,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P2.7 (docs/QA/Implementation-Plan.md): lifecycle transitions + demo skip.
 * Closes `LIFE-INT-002`, `LIFE-SEC-002` / Threat-Model `T-PLAT-05` / D6 / D45 /
 * Discrepancies D-16 (intentional demo exemption — must be tested).
 *
 * Where the boundary lives (read before asserting — not assumed):
 *   - `public.run_clinic_lifecycle_transitions()` — final body in
 *     `20260714210000_marketing_demo_clinic.sql` (live `pg_proc` matches).
 *     SECURITY DEFINER; `auth.role() = service_role` else `forbidden`.
 *     Loop 2: `status = readonly` AND `is_demo = false` AND
 *     `grace_ends_at < now()` → `pending_delete` + audit
 *     `clinic.marked_pending_delete`. Demo rows are excluded by the
 *     `is_demo = false` predicate (same migration also skips demos in the
 *     active→readonly loop).
 *   - `public.hard_delete_clinic(p_clinic_id)` — final body in
 *     `20260730120000_hard_delete_clinic_storage_api.sql`. service_role
 *     only; raises `demo_clinic` if `is_demo`; raises `not_pending_delete`
 *     unless status is `pending_delete`; then clinic cascade + auth users.
 *     Storage cleanup is app-layer Storage API (`lib/clinic/hard-delete.ts`).
 *   - App wiring (`lib/clinic/lifecycle-job.ts` + cron route) already
 *     gated by P1.10 (`LIFE-API-001`). This file asserts the **DB**
 *     transitions / demo guard the job calls — pattern **P1.4** (RPC via
 *     service-role client), not P1.10's route mock.
 *
 * Unique index `clinics_one_demo_idx` / `clinics_is_demo_unique_idx` allows
 * only one `is_demo = true` row. LIFE-SEC-002 temporarily clears any
 * existing marketing demo flag, marks the fixture clinic, then restores
 * in `finally` / `afterAll` so Demo Dental is never left non-demo.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function pastGraceIso(daysAgo = 1): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function futureGraceIso(daysAhead = 7): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

describeSecurity("P2.7 lifecycle transitions + demo skip (LIFE-INT/SEC-002)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let graceClinic: ClinicWithRoles;
  let controlClinic: ClinicWithRoles;
  let demoClinic: ClinicWithRoles;
  let allUsers: TestUser[] = [];

  /** Marketing / seed demo id if one existed before this suite touched `is_demo`. */
  let previousDemoClinicId: string | null = null;
  let demoFlagHeldByFixture = false;

  async function findDemoClinicId(): Promise<string | null> {
    const { data, error } = await service
      .from("clinics")
      .select("id")
      .eq("is_demo", true)
      .maybeSingle();
    if (error) {
      throw new Error(`find demo clinic: ${error.message}`);
    }
    return data?.id ?? null;
  }

  /**
   * Makes `clinicId` the sole `is_demo` clinic for the duration of `fn`,
   * restoring any prior marketing demo afterwards.
   */
  async function withFixtureAsDemo(
    clinicId: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const existing = await findDemoClinicId();
    if (existing && existing !== clinicId) {
      previousDemoClinicId = existing;
      const { error } = await service
        .from("clinics")
        .update({ is_demo: false })
        .eq("id", existing);
      if (error) throw new Error(`clear existing demo: ${error.message}`);
    }

    const { error: setError } = await service
      .from("clinics")
      .update({ is_demo: true })
      .eq("id", clinicId);
    if (setError) throw new Error(`set fixture demo: ${setError.message}`);
    demoFlagHeldByFixture = true;

    try {
      await fn();
    } finally {
      await service.from("clinics").update({ is_demo: false }).eq("id", clinicId);
      demoFlagHeldByFixture = false;
      if (previousDemoClinicId) {
        await service
          .from("clinics")
          .update({ is_demo: true })
          .eq("id", previousDemoClinicId);
      }
    }
  }

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    previousDemoClinicId = await findDemoClinicId();

    graceClinic = await createClinicWithRoles(service, {
      emailPrefix: "life-grace",
      clinicName: `Lifecycle Grace ${Date.now()}`,
      roles: ["owner"],
    });
    controlClinic = await createClinicWithRoles(service, {
      emailPrefix: "life-ctrl",
      clinicName: `Lifecycle Control ${Date.now()}`,
      roles: ["owner"],
    });
    demoClinic = await createClinicWithRoles(service, {
      emailPrefix: "life-demo",
      clinicName: `Lifecycle Demo ${Date.now()}`,
      roles: ["owner"],
    });

    allUsers = [...graceClinic.users, ...controlClinic.users, ...demoClinic.users];
  }, 120_000);

  afterAll(async () => {
    if (!service) return;

    // If a test aborted while the fixture held `is_demo`, clear it so
    // cleanupClinics' hard_delete path can succeed, then restore marketing demo.
    if (demoFlagHeldByFixture && demoClinic) {
      await service
        .from("clinics")
        .update({ is_demo: false })
        .eq("id", demoClinic.clinicId);
      demoFlagHeldByFixture = false;
    }
    if (previousDemoClinicId) {
      const current = await findDemoClinicId();
      if (current !== previousDemoClinicId) {
        if (current) {
          await service.from("clinics").update({ is_demo: false }).eq("id", current);
        }
        await service
          .from("clinics")
          .update({ is_demo: true })
          .eq("id", previousDemoClinicId);
      }
    }

    if (allUsers.length > 0) {
      await cleanupClinics(service, allUsers);
    }
  }, 120_000);

  it("LIFE-INT-002: readonly past grace → pending_delete via run_clinic_lifecycle_transitions", async () => {
    const { error: graceErr } = await service
      .from("clinics")
      .update({
        status: "readonly",
        grace_ends_at: pastGraceIso(2),
        is_demo: false,
      })
      .eq("id", graceClinic.clinicId);
    expect(graceErr).toBeNull();

    const { error: controlErr } = await service
      .from("clinics")
      .update({
        status: "readonly",
        grace_ends_at: futureGraceIso(7),
        is_demo: false,
      })
      .eq("id", controlClinic.clinicId);
    expect(controlErr).toBeNull();

    const { data, error } = await service.rpc("run_clinic_lifecycle_transitions");
    expect(error, "service_role transitions must succeed").toBeNull();

    const payload =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    const markedPending = asStringArray(payload.marked_pending_delete);

    expect(markedPending).toContain(graceClinic.clinicId);
    expect(markedPending).not.toContain(controlClinic.clinicId);

    const { data: afterGrace } = await service
      .from("clinics")
      .select("status")
      .eq("id", graceClinic.clinicId)
      .single();
    expect(afterGrace?.status).toBe("pending_delete");

    const { data: afterControl } = await service
      .from("clinics")
      .select("status")
      .eq("id", controlClinic.clinicId)
      .single();
    expect(afterControl?.status).toBe("readonly");

    const { data: auditRows } = await service
      .from("audit_events")
      .select("event_name, payload_json")
      .eq("clinic_id", graceClinic.clinicId)
      .eq("event_name", "clinic.marked_pending_delete");
    expect((auditRows ?? []).length).toBeGreaterThan(0);

    // Authenticated JWT must not execute the service_role-only RPC
    // (REVOKE … FROM authenticated — privilege denial, not empty success).
    const ownerClient = await signInAs(
      url,
      anonKey,
      graceClinic.byRole.owner!.email,
      graceClinic.byRole.owner!.password,
    );
    const denied = await ownerClient.rpc("run_clinic_lifecycle_transitions");
    expect(denied.error).not.toBeNull();
  }, 60_000);

  it("LIFE-SEC-002: is_demo clinic skipped by transitions + hard_delete refuses", async () => {
    await withFixtureAsDemo(demoClinic.clinicId, async () => {
      const { error: setupErr } = await service
        .from("clinics")
        .update({
          status: "readonly",
          grace_ends_at: pastGraceIso(3),
        })
        .eq("id", demoClinic.clinicId);
      expect(setupErr).toBeNull();

      const { data: transitionData, error: transitionError } = await service.rpc(
        "run_clinic_lifecycle_transitions",
      );
      expect(transitionError).toBeNull();

      const transitionPayload =
        transitionData &&
        typeof transitionData === "object" &&
        !Array.isArray(transitionData)
          ? (transitionData as Record<string, unknown>)
          : {};
      const markedPending = asStringArray(
        transitionPayload.marked_pending_delete,
      );
      expect(markedPending).not.toContain(demoClinic.clinicId);

      const { data: stillReadonly } = await service
        .from("clinics")
        .select("status, is_demo")
        .eq("id", demoClinic.clinicId)
        .single();
      expect(stillReadonly?.is_demo).toBe(true);
      expect(stillReadonly?.status).toBe("readonly");

      // Catalog preconditions: pending_delete + is_demo → hard_delete refuses.
      const { error: pendingErr } = await service
        .from("clinics")
        .update({ status: "pending_delete" })
        .eq("id", demoClinic.clinicId);
      expect(pendingErr).toBeNull();

      const { data: deleteData, error: deleteError } = await service.rpc(
        "hard_delete_clinic",
        { p_clinic_id: demoClinic.clinicId },
      );
      expect(deleteError, "demo hard_delete must fail").not.toBeNull();
      expect(deleteError?.message ?? "").toMatch(/demo_clinic/i);
      expect(deleteData).toBeNull();

      const { data: stillThere } = await service
        .from("clinics")
        .select("id, status, is_demo")
        .eq("id", demoClinic.clinicId)
        .maybeSingle();
      expect(stillThere?.id).toBe(demoClinic.clinicId);
      expect(stillThere?.is_demo).toBe(true);
      expect(stillThere?.status).toBe("pending_delete");
    });

    // After withFixtureAsDemo: fixture is non-demo again; marketing demo restored.
    const marketingDemo = previousDemoClinicId
      ? (
          await service
            .from("clinics")
            .select("is_demo")
            .eq("id", previousDemoClinicId)
            .maybeSingle()
        ).data
      : null;
    if (previousDemoClinicId) {
      expect(marketingDemo?.is_demo).toBe(true);
    }

    const { data: fixtureFlags } = await service
      .from("clinics")
      .select("is_demo")
      .eq("id", demoClinic.clinicId)
      .single();
    expect(fixtureFlags?.is_demo).toBe(false);
  }, 60_000);
});
