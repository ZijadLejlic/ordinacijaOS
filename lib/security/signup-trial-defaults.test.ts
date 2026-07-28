import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createAuthUser,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P6a — AUTH-INT-001 (D4 / D46 / D47): signup RPC defaults.
 *
 * **Mechanism (read, not invented):**
 * `public.create_clinic_for_owner` (live SECURITY DEFINER) defaults
 * `p_trial_ends_at` to `'2026-12-31 23:59:59+00'`. Column defaults on
 * `clinics` set `timezone = 'Europe/Sarajevo'` and
 * `phone_country_default = '+387'` when the RPC omits those columns.
 * App path: `ensureOwnerClinic` → same RPC with clinic/full name only.
 *
 * Does **not** re-run Playwright onboarding (`AUTH-E2E-001` already covers
 * wizard TZ/phone UI). This INT closes the trial_ends_at + column-default
 * gap at the RPC boundary.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const EXPECTED_TRIAL_END = "2026-12-31T23:59:59+00:00";

describeSecurity("signup trial + clinic defaults (AUTH-INT-001)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;
  let owner: TestUser | null = null;

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);
  });

  afterAll(async () => {
    if (!service || !owner) return;
    await cleanupClinics(service, [owner]);
  });

  it("create_clinic_for_owner sets trial_ends_at 2026-12-31 and TZ/phone defaults", async () => {
    const tag = randomTag();
    const email = `auth-int-001-${tag}@ordinacijaos.test`;
    const password = `Test-${tag}!Aa1`;
    const user = await createAuthUser(service, email, password);

    const client = await signInAs(url, anonKey, email, password);
    const { data: clinicId, error: rpcError } = await client.rpc(
      "create_clinic_for_owner",
      {
        p_clinic_name: `AUTH-INT-001 ${tag}`,
        p_full_name: `Owner ${tag}`,
      },
    );
    expect(rpcError).toBeNull();
    expect(clinicId).toBeTruthy();

    owner = {
      clinicId: clinicId as string,
      userId: user.id,
      email,
      password,
      role: "owner",
      fullName: `Owner ${tag}`,
    };

    const { data: clinic, error } = await service
      .from("clinics")
      .select("trial_ends_at, timezone, phone_country_default")
      .eq("id", clinicId as string)
      .single();

    expect(error).toBeNull();
    expect(new Date(clinic!.trial_ends_at!).toISOString()).toBe(
      new Date(EXPECTED_TRIAL_END).toISOString(),
    );
    expect(clinic!.timezone).toBe("Europe/Sarajevo");
    expect(clinic!.phone_country_default).toBe("+387");
  }, 60_000);
});
