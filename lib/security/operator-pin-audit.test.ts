import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OPERATOR_COOKIE } from "@/lib/operators/constants";
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
 * P6a — AUTH-INT-011 (D10): PIN create + switch audit operator_id.
 *
 * **Mechanism (read, not invented):**
 * `create_clinic_operator` inserts `audit_events` with
 * `event_name = 'operator.created'` and `operator_id` = new operator.
 * `verify_operator_pin` (success) inserts `operator.switched` with
 * `operator_id` set (`20260714050000_fix_verify_operator_pin_lockout.sql`).
 * SA wrappers: `createOperatorAction` / `switchOperatorAction`.
 *
 * Cross-clinic PIN deny already COVERED (`AUTH-SEC-002`). This INT closes
 * the audit operator_id half (was PARTIAL).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;

const cookieJar = new Map<string, string>();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeActionClient,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "bs",
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

class RedirectSentinel extends Error {
  constructor(readonly destination: unknown) {
    super("NEXT_REDIRECT");
    this.name = "RedirectSentinel";
  }
}

vi.mock("@/i18n/navigation", () => ({
  redirect: (destination: unknown) => {
    throw new RedirectSentinel(destination);
  },
}));

import {
  createOperatorAction,
  switchOperatorAction,
} from "@/lib/operators/actions";

describeSecurity("operator PIN audit operator_id (AUTH-INT-011)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let owner: TestUser;
  let reception: TestUser;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "reception"],
      clinicName: `AUTH-INT-011 ${randomTag()}`,
      planCode: "professional",
      emailPrefix: "auth-int-011",
    });
    owner = clinic.byRole.owner!;
    reception = clinic.byRole.reception!;
    created.push(...clinic.users);
  }, 60_000);

  afterAll(async () => {
    if (!service || created.length === 0) return;
    await cleanupClinics(service, created);
  });

  it("create + switch write audits with operator_id set", async () => {
    cookieJar.clear();
    activeActionClient = await signInAs(
      url,
      anonKey,
      owner.email,
      owner.password,
    );

    const pin = "2468";
    const createFd = new FormData();
    createFd.set("profileId", reception.userId);
    createFd.set("displayName", `Desk ${randomTag().slice(-6)}`);
    createFd.set("pin", pin);

    const createdResult = await createOperatorAction(null, createFd);
    expect(createdResult).toEqual({ message: "operatorCreated" });

    const { data: createdAudit, error: createdAuditError } = await service
      .from("audit_events")
      .select("operator_id, event_name")
      .eq("clinic_id", owner.clinicId)
      .eq("event_name", "operator.created")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(createdAuditError).toBeNull();
    expect(createdAudit!.operator_id).toBeTruthy();
    const operatorId = createdAudit!.operator_id!;

    activeActionClient = await signInAs(
      url,
      anonKey,
      reception.email,
      reception.password,
    );

    const switchFd = new FormData();
    switchFd.set("operatorId", operatorId);
    switchFd.set("pin", pin);

    try {
      await switchOperatorAction(null, switchFd);
      throw new Error("expected redirect after PIN switch");
    } catch (err) {
      if (!(err instanceof RedirectSentinel)) throw err;
    }

    expect(cookieJar.get(OPERATOR_COOKIE)).toBe(operatorId);

    const { data: switchAudit, error: switchAuditError } = await service
      .from("audit_events")
      .select("operator_id, event_name")
      .eq("clinic_id", owner.clinicId)
      .eq("event_name", "operator.switched")
      .eq("operator_id", operatorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(switchAuditError).toBeNull();
    expect(switchAudit!.operator_id).toBe(operatorId);
  }, 60_000);
});
