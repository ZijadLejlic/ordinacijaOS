import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  cleanupClinics,
  createClinicWithRoles,
  createPatient,
  createSupabaseClient,
  randomTag,
  signInAs,
  type DbClient,
  type TestUser,
} from "@/lib/security/factories";

/**
 * P2.6 (docs/QA/Implementation-Plan.md): Patient JSON + clinic ZIP API RBAC.
 * Closes `PII-API-001`, `PII-API-002` / Threat-Model `T-PII-04`.
 *
 * Where the boundary lives (read before asserting — not assumed):
 *   - `GET /api/privacy/patients/[patientId]/export`
 *     (`app/api/privacy/patients/[patientId]/export/route.ts`):
 *     session → `canExportPatientData(role)` (`lib/privacy/rbac.ts` —
 *     owner|doctor|assistant|reception; **not** accountant) →
 *     `buildPatientExport` (clinic_id scoped). Wrong role → **403**
 *     `{ error: "forbidden" }`. PRD §8.2 / Test-Strategy: accountant
 *     denied; clinical OK.
 *   - `GET /api/privacy/clinic/export`
 *     (`app/api/privacy/clinic/export/route.ts`):
 *     session → `canExportClinicBackup(role)` (owner only, PRD §8.3 /
 *     D45) → `buildClinicExportZip`. Non-owner → **403** `forbidden`;
 *     owner → **200** `application/zip`.
 *
 * Pattern: **P1.2 / P2.4** (`vi.mock("@/lib/supabase/server")` + call
 * route `GET` with `Request`). Success paths call `writeAuditEvent` →
 * `getOperatorIdFromCookie` → `next/headers` `cookies()`, so that is
 * mocked (same as P1.6 / P2.2 SA harness) — returns null operator, does
 * not change the RBAC gate under test.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

let activeRouteClient: DbClient;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => activeRouteClient,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

import { GET as getClinicExportRoute } from "@/app/api/privacy/clinic/export/route";
import { GET as getPatientExportRoute } from "@/app/api/privacy/patients/[patientId]/export/route";

describeSecurity("privacy export API RBAC (PII-API-001/002)", () => {
  let url: string;
  let anonKey: string;
  let serviceKey: string;
  let service: DbClient;

  let clinicId: string;
  let owner: TestUser;
  let doctor: TestUser;
  let accountant: TestUser;
  let patientId: string;

  const created: TestUser[] = [];

  beforeAll(async () => {
    ({ url, anonKey, serviceKey } = env!);
    service = createSupabaseClient(url, serviceKey);

    const clinic = await createClinicWithRoles(service, {
      roles: ["owner", "doctor", "accountant"],
      clinicName: `Privacy API ${randomTag()}`,
      planCode: "starter",
      emailPrefix: "pii-api",
    });
    clinicId = clinic.clinicId;
    owner = clinic.byRole.owner!;
    doctor = clinic.byRole.doctor!;
    accountant = clinic.byRole.accountant!;
    created.push(...clinic.users);

    const patient = await createPatient(service, clinicId, {
      firstName: "PrivacyAPI",
      lastName: "Patient",
    });
    patientId = patient.id;
  }, 60_000);

  afterAll(async () => {
    if (!service || created.length === 0) return;
    await cleanupClinics(service, created);
  }, 60_000);

  // ---------------------------------------------------------------------
  // PII-API-001 — Patient JSON export without clinical role
  // ---------------------------------------------------------------------

  it("PII-API-001: accountant session gets 403 on patient JSON export", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      accountant.email,
      accountant.password,
    );

    const response = await getPatientExportRoute(
      new Request(
        `http://localhost/api/privacy/patients/${patientId}/export`,
      ),
      { params: Promise.resolve({ patientId }) },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
  });

  it("PII-API-001: doctor session gets 200 JSON (clinical positive control)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      doctor.email,
      doctor.password,
    );

    const response = await getPatientExportRoute(
      new Request(
        `http://localhost/api/privacy/patients/${patientId}/export`,
      ),
      { params: Promise.resolve({ patientId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    const payload = await response.json();
    expect(payload.clinic_id).toBe(clinicId);
    expect(payload.patient).toMatchObject({
      id: patientId,
      first_name: "PrivacyAPI",
      last_name: "Patient",
    });
    expect(Array.isArray(payload.allergies)).toBe(true);
    expect(Array.isArray(payload.invoices)).toBe(true);
  });

  // ---------------------------------------------------------------------
  // PII-API-002 — Clinic ZIP backup non-owner
  // ---------------------------------------------------------------------

  it("PII-API-002: doctor session gets 403 on clinic ZIP export", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      doctor.email,
      doctor.password,
    );

    const response = await getClinicExportRoute();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
  });

  it("PII-API-002: owner session gets 200 ZIP (positive control)", async () => {
    activeRouteClient = await signInAs(
      url,
      anonKey,
      owner.email,
      owner.password,
    );

    const response = await getClinicExportRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    const buffer = Buffer.from(await response.arrayBuffer());
    // ZIP — PK magic
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer.byteLength).toBeGreaterThan(100);
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/\.zip"/);
  });
});
