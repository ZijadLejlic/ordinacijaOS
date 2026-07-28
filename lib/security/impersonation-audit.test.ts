import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IMPERSONATION_COOKIE } from "@/lib/platform/constants";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createAuthUser,
  createClinicWithRoles,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P2.8 (docs/QA/Implementation-Plan.md): Impersonation audit (D41).
 * Closes `PLAT-INT-001` / Threat-Model `T-PLAT-01` / AC7.
 *
 * Where the boundary lives (grepped — not assumed):
 *   - `startImpersonationAction` / `stopImpersonationAction` in
 *     `lib/platform/actions.ts` (Server Actions). Platform-admin gate via
 *     `isPlatformAdmin` (`app_metadata.is_platform_admin === true`, never
 *     `user_metadata`). Session switch via Auth Admin `generateLink` +
 *     `verifyOtp`. Cookie `oos_platform_impersonation` via
 *     `lib/platform/session.ts`.
 *   - Audit is **SA-written** through service-role `writeAuditEvent`:
 *     `platform.impersonation_start` / `platform.impersonation_stop` with
 *     payload phases `requested` → `succeeded` (or `failed`). There is no
 *     DB RPC / RLS trigger that creates these rows — boundary is the SA.
 *
 * Pattern: **P1.6 / P2.5 SA** (`vi.mock` Next plumbing + call real actions).
 * Cookie store is stateful so stop can read what start wrote. Sticky-cookie
 * after stop (`PLAT-SEC-002`) is out of scope.
 *
 * `createServiceClient` is also mocked: product `lib/supabase/service.ts`
 * constructs a client without a `ws` Realtime transport, which throws in
 * Node 20 Vitest (`getWebSocketConstructor`). Next.js server runtime has a
 * WebSocket global so production is fine — the mock swaps in the same
 * `createSupabaseClient` (+ `ws`) every other security file already uses.
 * Auth Admin / audit inserts still hit the real project via service role.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;
/** Service-role client for SA body (`createServiceClient` mock target). */
let serviceForActions: DbClient;

/** In-memory cookie jar so start → stop shares impersonation payload. */
const cookieJar = new Map<string, string>();

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

// Textually after the mocks above on purpose (Vitest hoists `vi.mock`).
import {
  startImpersonationAction,
  stopImpersonationAction,
} from "@/lib/platform/actions";

type AuditRow = {
  event_name: string;
  actor_user_id: string | null;
  payload_json: unknown;
};

function asPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function listImpersonationAudits(
  service: DbClient,
  clinicId: string,
): Promise<AuditRow[]> {
  const { data, error } = await service
    .from("audit_events")
    .select("event_name, actor_user_id, payload_json")
    .eq("clinic_id", clinicId)
    .in("event_name", [
      "platform.impersonation_start",
      "platform.impersonation_stop",
    ])
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`list impersonation audits: ${error.message}`);
  }
  return data ?? [];
}

function hasPhase(
  rows: AuditRow[],
  eventName: string,
  phase: string,
  actorUserId: string,
  targetUserId: string,
): boolean {
  return rows.some((row) => {
    if (row.event_name !== eventName) return false;
    if (row.actor_user_id !== actorUserId) return false;
    const payload = asPayload(row.payload_json);
    return (
      payload.phase === phase && payload.target_user_id === targetUserId
    );
  });
}

async function expectRedirect(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    throw new Error("expected redirect() to throw NEXT_REDIRECT");
  } catch (err) {
    if (err instanceof RedirectSentinel) return;
    throw err;
  }
}

describeSecurity("P2.8 impersonation audit (PLAT-INT-001)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinicId: string;
  let owner: TestUser;
  let platformAdminId: string;
  let platformAdminEmail: string;
  let platformAdminPassword: string;

  const created: TestUser[] = [];
  const orphanAuthUserIds: string[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);
    serviceForActions = service;

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner"],
      clinicName: `Impersonation Audit ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "plat-int",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    created.push(...clinic.users);

    platformAdminPassword = `Pw-${randomTag()}!aA1`;
    platformAdminEmail = `plat-admin-${randomTag()}@ordinacijaos.test`;
    const adminUser = await createAuthUser(
      service,
      platformAdminEmail,
      platformAdminPassword,
    );
    platformAdminId = adminUser.id;
    orphanAuthUserIds.push(platformAdminId);

    const { error: metaError } = await service.auth.admin.updateUserById(
      platformAdminId,
      { app_metadata: { is_platform_admin: true } },
    );
    if (metaError) {
      throw new Error(`set is_platform_admin: ${metaError.message}`);
    }
  }, 60_000);

  beforeEach(() => {
    cookieJar.clear();
  });

  afterAll(async () => {
    if (!service) return;
    if (created.length > 0) {
      await cleanupClinics(service, created);
    }
    for (const userId of orphanAuthUserIds) {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }, 60_000);

  it("start then stop write platform.impersonation_* audit rows (AC7)", async () => {
    activeActionClient = await signInAs(
      url,
      anonKey,
      platformAdminEmail,
      platformAdminPassword,
    );

    const {
      data: { user: adminSession },
    } = await activeActionClient.auth.getUser();
    expect(adminSession?.app_metadata?.is_platform_admin).toBe(true);

    const formData = new FormData();
    formData.set("clinicId", clinicId);

    await expectRedirect(() =>
      startImpersonationAction(null, formData),
    );

    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(true);

    const {
      data: { user: afterStart },
    } = await activeActionClient.auth.getUser();
    expect(afterStart?.id).toBe(owner.userId);

    const afterStartAudits = await listImpersonationAudits(service, clinicId);
    expect(
      hasPhase(
        afterStartAudits,
        "platform.impersonation_start",
        "requested",
        platformAdminId,
        owner.userId,
      ),
    ).toBe(true);
    expect(
      hasPhase(
        afterStartAudits,
        "platform.impersonation_start",
        "succeeded",
        platformAdminId,
        owner.userId,
      ),
    ).toBe(true);
    expect(
      afterStartAudits.some(
        (r) => r.event_name === "platform.impersonation_stop",
      ),
    ).toBe(false);

    await expectRedirect(() => stopImpersonationAction());

    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(false);

    const {
      data: { user: afterStop },
    } = await activeActionClient.auth.getUser();
    expect(afterStop?.id).toBe(platformAdminId);

    const finalAudits = await listImpersonationAudits(service, clinicId);
    expect(
      hasPhase(
        finalAudits,
        "platform.impersonation_stop",
        "requested",
        platformAdminId,
        owner.userId,
      ),
    ).toBe(true);
    expect(
      hasPhase(
        finalAudits,
        "platform.impersonation_stop",
        "succeeded",
        platformAdminId,
        owner.userId,
      ),
    ).toBe(true);
  }, 90_000);

  it("non-platform-admin start is rejected without impersonation audit", async () => {
    activeActionClient = await signInAs(
      url,
      anonKey,
      owner.email,
      owner.password,
    );

    const before = await listImpersonationAudits(service, clinicId);

    const formData = new FormData();
    formData.set("clinicId", clinicId);
    const result = await startImpersonationAction(null, formData);

    expect(result).toEqual({ error: "forbidden" });
    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(false);

    const after = await listImpersonationAudits(service, clinicId);
    expect(after).toHaveLength(before.length);
  }, 60_000);
});
