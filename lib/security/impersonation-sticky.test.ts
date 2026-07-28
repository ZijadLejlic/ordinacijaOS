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
 * P6a — PLAT-SEC-002 (D41 / T-PLAT-02): sticky impersonation cookie.
 *
 * **Mechanism (read, not invented — same as PLAT-INT-001):**
 * `stopImpersonationAction` clears `oos_platform_impersonation` on success
 * and on early mismatch (`user.id !== payload.targetUserId`). Middleware
 * also clears when session user ≠ cookie target and caller is not a
 * platform admin (`middleware.ts` sticky-clear block).
 *
 * This SEC file asserts the stop/clear path (cookie gone; session back to
 * platform admin). Does not invent a new auth model.
 *
 * Pattern: P2.8 SA harness (cookie jar + real start/stop).
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeActionClient: DbClient;
let serviceForActions: DbClient;

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

import {
  startImpersonationAction,
  stopImpersonationAction,
} from "@/lib/platform/actions";

async function expectRedirect(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    throw new Error("expected redirect() to throw NEXT_REDIRECT");
  } catch (err) {
    if (err instanceof RedirectSentinel) return;
    throw err;
  }
}

describeSecurity("impersonation sticky cookie clear (PLAT-SEC-002)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinicId: string;
  let owner: TestUser;
  let reception: TestUser;
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
      roles: ["owner", "reception"],
      clinicName: `PLAT-SEC-002 ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "plat-sec-002",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    reception = clinic.byRole.reception!;
    created.push(...clinic.users);

    platformAdminPassword = `Pw-${randomTag()}!aA1`;
    platformAdminEmail = `plat-sec-admin-${randomTag()}@ordinacijaos.test`;
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

  it("stop clears impersonation cookie and restores platform-admin session", async () => {
    activeActionClient = await signInAs(
      url,
      anonKey,
      platformAdminEmail,
      platformAdminPassword,
    );

    const fd = new FormData();
    fd.set("clinicId", clinicId);
    await expectRedirect(() => startImpersonationAction(null, fd));
    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(true);

    await expectRedirect(() => stopImpersonationAction());
    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(false);

    const {
      data: { user: afterStop },
    } = await activeActionClient.auth.getUser();
    expect(afterStop?.id).toBe(platformAdminId);
    expect(afterStop?.app_metadata?.is_platform_admin).toBe(true);
  }, 90_000);

  it("mismatch session clears sticky cookie without leaving clinic target sticky", async () => {
    // Plant a stale impersonation cookie targeting owner while session is reception.
    cookieJar.set(
      IMPERSONATION_COOKIE,
      JSON.stringify({
        adminUserId: platformAdminId,
        adminEmail: platformAdminEmail,
        clinicId,
        targetUserId: owner.userId,
        startedAt: new Date().toISOString(),
      }),
    );

    activeActionClient = await signInAs(
      url,
      anonKey,
      reception.email,
      reception.password,
    );

    await stopImpersonationAction();
    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(false);

    const {
      data: { user },
    } = await activeActionClient.auth.getUser();
    expect(user?.id).toBe(reception.userId);
  }, 60_000);
});
