import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Secret, TOTP } from "otpauth";
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
 * P1.3 (docs/QA/Implementation-Plan.md): owner MFA aal2 write denial under
 * RLS. Closes `AUTH-RLS-001` / Threat-Model `T-AUTH-02` / AC3 ("Owner MFA
 * downgrade" — owner completes login at aal1 and POSTs clinical/finance
 * mutations; must fail at RLS restrictive policies).
 *
 * `public.owner_mfa_ok()` (supabase/migrations/20260713000006_code_review_
 * b5_jwt_custom_claims.sql — the `create or replace` that wins over the
 * phase1 bootstrap definition) returns:
 *   - `true` if the actor is not the clinic owner (restriction targets
 *     owner only — see the "bonus" test below);
 *   - `true` if the current JWT's `aal` claim is already `aal2`;
 *   - `true` if the owner has **no verified** TOTP factor yet (writes stay
 *     open until enrollment — that's `AUTH-E2E-003`'s middleware-redirect
 *     job, not this RLS test's);
 *   - `false` **only** when the owner has a verified factor but the
 *     *current session* is aal1 (logged in, but never stepped up) — this
 *     is the exact case this file proves.
 * It gates every `*_owner_mfa_aal2` restrictive (or, for the invoices/
 * payments/treatment_plans group, permissive-but-`for all`) policy —
 * grepped across `supabase/migrations/**`: clinics, profiles, audit_events,
 * clinic_invites, clinic_locations, clinic_operators, clinic_subscriptions,
 * services, patients, patient_allergies, patient_documents, patient_images,
 * odontogram_teeth/events, appointments, appointment_waitlist,
 * treatment_plans/items, invoices/invoice_lines/payments/payment_plans(+
 * installments), expenses, email_templates, outbound_messages,
 * crm_notifications, gdpr_erasure_requests, consent_forms/signatures,
 * inventory_items. Per the task scope this file spot-checks two
 * representative tables under one `AUTH-RLS-001` ID rather than adding a
 * new per-table matrix: `patients` (RESTRICTIVE, owner+doctor+assistant+
 * reception can otherwise write it — picked so the "bonus" non-owner test
 * below is meaningful) and `clinics` (RESTRICTIVE, owner-only baseline
 * policy `clinics_update_owner`, so a denial here can only be the MFA gate,
 * never an unrelated RBAC gap).
 *
 * MFA flow (Supabase JS `supabase.auth.mfa.*`, no Playwright/browser
 * needed — same `otpauth` library as `e2e/helpers/mfa.ts`'s `totpCode`,
 * reimplemented locally since that helper file imports
 * `type { Page } from "@playwright/test"` and is not safe to import from a
 * Vitest file):
 *   1. `mfa.enroll({ factorType: "totp" })` on a freshly signed-in owner
 *      session returns `data.id` (factorId) + `data.totp.secret` (base32).
 *   2. `mfa.challenge({ factorId })` + `mfa.verify({ factorId, challengeId,
 *      code })` with a TOTP code computed from that secret. This *first*
 *      verify both activates the factor (`unverified` → `verified`) and
 *      raises the *current* session to aal2 (Supabase's documented
 *      behavior for the session that just proved factor possession) — so
 *      this session cannot be used for the aal1-denial case, only as the
 *      "aal2 already allows the write" positive control.
 *   3. To get an aal1 session with an *already-verified* factor (the case
 *      `owner_mfa_ok()` must deny), sign in again on a brand-new client
 *      with the same credentials — the RLS test's core premise, called
 *      out explicitly in the P1.3 task brief: a fresh login is aal1 until
 *      that specific session does its own challenge+verify step-up.
 *   4. Step that second session up with `mfa.challenge` +`mfa.verify` again
 *      (fresh TOTP code — same factor) as the positive control proving the
 *      denial in step 3 was really aal1-vs-aal2 and not some other RBAC/
 *      RLS bug: the identical write must now succeed on the identical
 *      session.
 *
 * `supabase/config.toml` `[auth.mfa]`/`[auth.mfa.totp]` (`enroll_enabled =
 * true`, `verify_enabled = true`, committed in P0.2) is required for any of
 * this to work against local Supabase; no other MFA enforcement flag in
 * config.toml gates sign-in itself — GoTrue issues an aal1 access token on
 * a plain `signInWithPassword` regardless of enrolled factors, exactly the
 * scenario this test exploits to produce an aal1-with-verified-factor
 * session. (The "owner without MFA must be redirected before reaching the
 * app" enforcement is `AUTH-E2E-003`'s Next.js middleware job, not GoTrue's
 * — GoTrue itself never blocks sign-in for missing/unverified MFA.)
 *
 * Result of writing this file: no product/RLS bug found — this is a pure
 * test-authoring task, matching P1.1/P1.2's precedent.
 */

function totpCodeFor(secret: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret.replace(/\s+/g, "")),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

/**
 * Polls (max ~30s, one TOTP period) until a code different from `avoid` is
 * available. Two `mfa.verify` calls made within the same 30s window would
 * otherwise submit the identical 6-digit code twice; GoTrue's replay
 * handling for that isn't documented, so this sidesteps the question
 * entirely instead of relying on same-code reuse being accepted.
 */
async function freshTotpCode(secret: string, avoid?: string): Promise<string> {
  let code = totpCodeFor(secret);
  while (avoid !== undefined && code === avoid) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    code = totpCodeFor(secret);
  }
  return code;
}

function decodeAal(accessToken: string): string | undefined {
  const payload = accessToken.split(".")[1];
  if (!payload) return undefined;
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return (JSON.parse(json) as { aal?: string }).aal;
}

/** Runs challenge+verify on `client` for `factorId` and returns the code used. */
async function stepUpToAal2(
  client: DbClient,
  factorId: string,
  secret: string,
  avoidCode?: string,
): Promise<string> {
  const code = await freshTotpCode(secret, avoidCode);

  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) {
    throw new Error(`mfa.challenge failed: ${challenge.error?.message ?? "no data"}`);
  }

  const verify = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) {
    throw new Error(`mfa.verify failed: ${verify.error.message}`);
  }

  return code;
}

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

describeSecurity("owner MFA aal2 write denial under RLS (release blocker)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinicId: string;
  let owner: TestUser;
  let doctor: TestUser;
  const created: TestUser[] = [];

  let factorId: string;
  let secret: string;
  let lastCode: string;

  // The initial enroll+verify session — already aal2 by the time it's
  // usable, kept around only for the setup/positive-control test.
  let enrollSession: DbClient;

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor"],
      clinicName: `MFA aal2 ${randomTag()}`,
      emailPrefix: "mfa-aal2",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    doctor = clinic.byRole.doctor!;
    created.push(...clinic.users);

    enrollSession = await signInAs(url, anonKey, owner.email, owner.password);

    const enroll = await enrollSession.auth.mfa.enroll({ factorType: "totp" });
    if (enroll.error || !enroll.data) {
      throw new Error(`mfa.enroll failed: ${enroll.error?.message ?? "no data"}`);
    }
    factorId = enroll.data.id;
    secret = enroll.data.totp.secret;
    if (!secret || secret.length < 16) {
      throw new Error(`enrolled TOTP secret missing or too short: "${secret}"`);
    }

    // First verify of a brand-new factor: activates it AND raises this
    // session to aal2 in the same call.
    lastCode = await stepUpToAal2(enrollSession, factorId, secret);
  }, 60_000);

  afterAll(async () => {
    await cleanupClinics(service, created);
  }, 60_000);

  async function insertProbePatient(client: DbClient, label: string) {
    return client.from("patients").insert({
      clinic_id: clinicId,
      first_name: "AAL2Probe",
      last_name: label,
      phone: "+38761123456",
      is_active: true,
    });
  }

  async function updateProbeClinic(client: DbClient) {
    return client
      .from("clinics")
      .update({ settings_json: { aal2_probe: randomTag() } })
      .eq("id", clinicId);
  }

  it("AUTH-RLS-001 setup: enroll+verify raises the enrolling session to aal2, and that aal2 session can write", async () => {
    const { data: sessionData, error: sessionError } = await enrollSession.auth.getSession();
    expect(sessionError).toBeNull();
    expect(decodeAal(sessionData.session!.access_token)).toBe("aal2");

    const patientInsert = await insertProbePatient(enrollSession, "EnrollSessionAal2");
    expect(patientInsert.error).toBeNull();

    const clinicUpdate = await updateProbeClinic(enrollSession);
    expect(clinicUpdate.error).toBeNull();
  });

  it("AUTH-RLS-001: a fresh owner login (verified factor, not stepped up) is aal1, and its writes are denied", async () => {
    const freshLogin = await signInAs(url, anonKey, owner.email, owner.password);

    const { data: sessionData, error: sessionError } = await freshLogin.auth.getSession();
    expect(sessionError).toBeNull();
    expect(decodeAal(sessionData.session!.access_token)).toBe("aal1");

    const patientInsert = await insertProbePatient(freshLogin, "FreshLoginAal1Denied");
    expect(patientInsert.error).not.toBeNull();

    const clinicUpdate = await updateProbeClinic(freshLogin);
    expect(clinicUpdate.error).not.toBeNull();
  });

  it("AUTH-RLS-001 positive control: stepping the SAME aal1 session up to aal2 makes the identical writes succeed", async () => {
    const freshLogin = await signInAs(url, anonKey, owner.email, owner.password);

    const { data: beforeStepUp } = await freshLogin.auth.getSession();
    expect(decodeAal(beforeStepUp.session!.access_token)).toBe("aal1");

    lastCode = await stepUpToAal2(freshLogin, factorId, secret, lastCode);

    const { data: afterStepUp } = await freshLogin.auth.getSession();
    expect(decodeAal(afterStepUp.session!.access_token)).toBe("aal2");

    const patientInsert = await insertProbePatient(freshLogin, "SteppedUpAal2Allowed");
    expect(patientInsert.error).toBeNull();

    const clinicUpdate = await updateProbeClinic(freshLogin);
    expect(clinicUpdate.error).toBeNull();
  });

  it("AUTH-RLS-001 bonus: non-owner (doctor) aal1 write is NOT blocked by owner_mfa_ok() (restriction targets owner only)", async () => {
    const doctorSession = await signInAs(url, anonKey, doctor.email, doctor.password);

    const { data: sessionData } = await doctorSession.auth.getSession();
    expect(decodeAal(sessionData.session!.access_token)).toBe("aal1");

    const patientInsert = await insertProbePatient(doctorSession, "DoctorAal1NotBlocked");
    expect(patientInsert.error).toBeNull();
  });
});
