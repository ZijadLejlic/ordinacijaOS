import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
 * P6a — PLAN-DB-003 (D8): Pro plan blocks the 6th doctor seat at the DB
 * layer via `plan_limit_doctors`.
 *
 * **Mechanism (read, not invented):**
 * `public.enforce_invite_limits()` (`20260713000002_code_review_a2_plan_limit_enforcement.sql`)
 * is a `before insert` trigger on `clinic_invites`. For `role = 'doctor'` it
 * counts active doctor profiles + pending doctor invites against
 * `plans.limits_json.doctors` and raises `plan_limit_doctors`
 * (`check_violation`) when at/over cap — same family as `plan_limit_users`
 * (`PLAN-DB-001`) and `plan_limit_locations` (`PLAN-DB-002`).
 *
 * Professional seed: `doctors: 5`, `users: 10`. Fixture = owner + 5 active
 * doctors (6 users, under user cap) then owner INSERT of a 6th doctor invite.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("plan limit doctors DB hard gate (D8 / PLAN-DB-003)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let owner: TestUser;
  let doctorLimit: number;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const { data: plan, error: planError } = await service
      .from("plans")
      .select("limits_json")
      .eq("code", "professional")
      .single();
    if (planError || !plan) {
      throw new Error(planError?.message ?? "professional plan not found");
    }
    const limitsJson = plan.limits_json;
    const parsed =
      limitsJson &&
      typeof limitsJson === "object" &&
      !Array.isArray(limitsJson) &&
      typeof limitsJson.doctors === "number"
        ? limitsJson.doctors
        : null;
    if (parsed === null) {
      throw new Error(
        "professional plan has no numeric doctors limit — PLAN-DB-003 cannot proceed",
      );
    }
    doctorLimit = parsed;

    const roles = [
      "owner" as const,
      ...Array.from({ length: doctorLimit }, () => "doctor" as const),
    ];
    const clinic = await createClinicWithRoles(service, {
      roles,
      clinicName: `PLAN-DB-003 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "plan-db-003",
    });
    owner = clinic.byRole.owner!;
    created.push(...clinic.users);

    const doctorCount = clinic.users.filter((u) => u.role === "doctor").length;
    if (doctorCount !== doctorLimit) {
      throw new Error(
        `expected ${doctorLimit} doctor profiles, got ${doctorCount}`,
      );
    }
  }, 120_000);

  afterAll(async () => {
    if (!service || created.length === 0) return;
    await cleanupClinics(service, created);
  });

  it("professional plan blocks the (doctors+1)th doctor invite at DB layer", async () => {
    const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    const tag = randomTag().replace(/[^a-f0-9]/g, "0").slice(0, 24);

    const { error: overLimitError } = await ownerClient
      .from("clinic_invites")
      .insert({
        clinic_id: owner.clinicId,
        email: `plan-db-003-over-${tag}@ordinacijaos.test`,
        full_name: "Over Doctor Cap",
        role: "doctor",
        token_hash: `${tag}${"c".repeat(64 - tag.length)}`.slice(0, 64),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        status: "pending",
        invited_by: owner.userId,
      });

    expect(overLimitError).not.toBeNull();
    expect(overLimitError?.message.toLowerCase()).toContain("plan_limit_doctors");
  }, 60_000);

  it("non-doctor invite still succeeds when doctor seats are at cap (user seats remain)", async () => {
    const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    const tag = randomTag().replace(/[^a-f0-9]/g, "0").slice(0, 24);

    const { error } = await ownerClient.from("clinic_invites").insert({
      clinic_id: owner.clinicId,
      email: `plan-db-003-reception-${tag}@ordinacijaos.test`,
      full_name: "Reception Under User Cap",
      role: "reception",
      token_hash: `${tag}${"d".repeat(64 - tag.length)}`.slice(0, 64),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      status: "pending",
      invited_by: owner.userId,
    });

    expect(error).toBeNull();
  }, 60_000);

  it("D56: owner cannot turn on practices_as_doctor when doctor seats are at cap", async () => {
    const ownerClient = await signInAs(url, anonKey, owner.email, owner.password);
    const { error } = await ownerClient
      .from("profiles")
      .update({ practices_as_doctor: true })
      .eq("id", owner.userId);

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("plan_limit_doctors");
  }, 60_000);
});
