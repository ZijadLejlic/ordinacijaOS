import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  createSupabaseClient,
  type DbClient,
} from "@/lib/security/factories";

/**
 * P3.3 (docs/QA/Implementation-Plan.md): all 8 app/api route auth
 * matrix — unauthenticated + wrong-role (where product has role) + happy
 * path positive control.
 *
 * Inventory (grepped app/api route handlers, not assumed):
 *   1. GET /api/health — public liveness { ok: true }; detailed
 *      checks only when Authorization: Bearer $CRON_SECRET
 *   2. GET /api/cron/clinic-lifecycle — secret gate (not session)
 *   3. GET /api/invoices/[invoiceId]/pdf — session + canAccessInvoices
 *   4. GET /api/reports/excel — session + canAccessExpenses + feature
 *   5. GET /api/privacy/patients/[patientId]/export — session +
 *      canExportPatientData
 *   6. GET /api/privacy/clinic/export — session + canExportClinicBackup
 *   7. GET /api/og — intentionally public marketing OG image (no auth)
 *   8. GET /api/sentry-test — production without SENTRY_ENABLE_TEST_ENDPOINTS
 *      → 404; otherwise DSN-gated (TEMPORARY probe; remove after verification)
 *
 * Already COVERED — do not re-implement (matrix cites them):
 *   - cron secret → LIFE-API-001 / cron-secret-guard.test.ts (unit)
 *   - PDF wrong-role + happy → FIN-API-001 / finance-api-rbac.test.ts
 *   - PDF IDOR + unauth 401 → FILE-SEC-003 / storage-isolation.test.ts
 *   - Excel wrong-role/feature + happy → FIN-API-002
 *   - Patient JSON wrong-role + happy → PII-API-001
 *   - Clinic ZIP wrong-role + happy → PII-API-002
 *
 * This file's job (gaps + public/env truth):
 *   - Session routes: unauthenticated → 401 (excel + privacy x2;
 *     PDF unauth already FILE-SEC-003 — thin matrix assert only)
 *   - health / og / sentry-test: assert code truth (public / env-gated),
 *     not invented RBAC
 *   - cron: thin re-assert of the unauth 401 path (source of truth remains
 *     LIFE-API-001; job mocked so this stays DB-free)
 *
 * Catalog IDs closed here: PLAT-API-001 (health), PLAT-API-002
 * (sentry-test), MKT-API-001 (og); extends unauth half of
 * FIN-API-002 / PII-API-001 / PII-API-002 (PDF unauth stays
 * FILE-SEC-003). Pattern: P1.2 / P2.4 / P2.6.
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

const { runClinicLifecycleJob } = vi.hoisted(() => ({
  runClinicLifecycleJob: vi.fn(async () => ({
    markedReadonly: [] as string[],
    markedPendingDelete: [] as string[],
    deleted: [] as Array<{ clinicId: string; ok: boolean; error?: string }>,
  })),
}));

vi.mock("@/lib/clinic/lifecycle-job", () => ({
  runClinicLifecycleJob,
}));

const { sentryCaptureMessage, sentryFlush, sentryCaptureException, sentryWithScope } =
  vi.hoisted(() => ({
    sentryCaptureMessage: vi.fn(() => "test-event-id"),
    sentryFlush: vi.fn(async () => true),
    sentryCaptureException: vi.fn(() => "test-exc-id"),
    sentryWithScope: vi.fn((fn: (scope: { setTag: () => void }) => unknown) =>
      fn({ setTag: vi.fn() }),
    ),
  }));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: sentryCaptureMessage,
  captureException: sentryCaptureException,
  flush: sentryFlush,
  withScope: sentryWithScope,
  setUser: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

/** Auth matrix only: prove no session gate before ImageResponse. */
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    // Auth matrix only: prove no session gate before ImageResponse.
    constructor() {
      super("og-image-placeholder", {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
  },
}));

import { GET as getClinicLifecycleCron } from "@/app/api/cron/clinic-lifecycle/route";
import { GET as getHealthRoute } from "@/app/api/health/route";
import { GET as getInvoicePdfRoute } from "@/app/api/invoices/[invoiceId]/pdf/route";
import { GET as getOgRoute } from "@/app/api/og/route";
import { GET as getClinicExportRoute } from "@/app/api/privacy/clinic/export/route";
import { GET as getPatientExportRoute } from "@/app/api/privacy/patients/[patientId]/export/route";
import { GET as getExcelReportRoute } from "@/app/api/reports/excel/route";
import { GET as getSentryTestRoute } from "@/app/api/sentry-test/route";

const FAKE_UUID = "00000000-0000-4000-8000-000000000001";

// =============================================================================
// DB-free: health / og / sentry-test / cron thin reference
// =============================================================================

describe("API routes auth matrix — public / env-gated (DB-free)", () => {
  describe("PLAT-API-001: GET /api/health", () => {
    const previousSecret = process.env.CRON_SECRET;

    afterEach(() => {
      if (previousSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previousSecret;
      }
    });

    it("unauthenticated → 200 public liveness only (no checks object)", async () => {
      process.env.CRON_SECRET = "health-matrix-secret";

      const res = await getHealthRoute(
        new Request("http://localhost/api/health"),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(body.checks).toBeUndefined();
    });

    it("wrong Bearer → still public liveness (not 401 — secret only unlocks detail)", async () => {
      process.env.CRON_SECRET = "health-matrix-secret";

      const res = await getHealthRoute(
        new Request("http://localhost/api/health", {
          headers: { authorization: "Bearer wrong" },
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(body.checks).toBeUndefined();
    });

    it("correct Bearer $CRON_SECRET → 200 with checks booleans (no secret values)", async () => {
      process.env.CRON_SECRET = "health-matrix-secret";

      const res = await getHealthRoute(
        new Request("http://localhost/api/health", {
          headers: { authorization: "Bearer health-matrix-secret" },
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.checks).toMatchObject({
        cron: true,
        supabaseUrl: expect.any(Boolean),
        serviceRole: expect.any(Boolean),
      });
      // Never echo the secret itself
      expect(JSON.stringify(body)).not.toContain("health-matrix-secret");
    });
  });

  describe("MKT-API-001: GET /api/og (intentionally public)", () => {
    it("no auth → 200 image response (marketing OG; no session/RBAC)", async () => {
      const res = await getOgRoute(
        new Request("http://localhost/api/og?title=DentOrd"),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/image\/png/);
    });
  });

  describe("PLAT-API-002: GET /api/sentry-test (env-gated, no session RBAC)", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const previousTestFlag = process.env.SENTRY_ENABLE_TEST_ENDPOINTS;

    afterEach(() => {
      vi.stubEnv("NODE_ENV", previousNodeEnv ?? "test");
      if (previousDsn === undefined) {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      } else {
        process.env.NEXT_PUBLIC_SENTRY_DSN = previousDsn;
      }
      if (previousTestFlag === undefined) {
        delete process.env.SENTRY_ENABLE_TEST_ENDPOINTS;
      } else {
        process.env.SENTRY_ENABLE_TEST_ENDPOINTS = previousTestFlag;
      }
      sentryCaptureMessage.mockClear();
      sentryCaptureException.mockClear();
      sentryFlush.mockClear();
    });

    it("production without test flag → 404 (probe denied)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      delete process.env.SENTRY_ENABLE_TEST_ENDPOINTS;
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example.ingest.sentry.io/1";

      const res = await getSentryTestRoute(
        new Request("http://localhost/api/sentry-test"),
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toEqual({ ok: false });
      expect(sentryCaptureMessage).not.toHaveBeenCalled();
    });

    it("production with SENTRY_ENABLE_TEST_ENDPOINTS=1 + DSN → 200", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.SENTRY_ENABLE_TEST_ENDPOINTS = "1";
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example.ingest.sentry.io/1";

      const res = await getSentryTestRoute(
        new Request("http://localhost/api/sentry-test"),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(sentryCaptureMessage).toHaveBeenCalledTimes(1);
      expect(sentryFlush).toHaveBeenCalledTimes(1);
    });

    it("non-production without DSN → 500 (fail closed on missing config)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const res = await getSentryTestRoute(
        new Request("http://localhost/api/sentry-test"),
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/NEXT_PUBLIC_SENTRY_DSN/);
      expect(sentryCaptureMessage).not.toHaveBeenCalled();
    });

    it("non-production with DSN → 200 and captures once (positive control)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example.ingest.sentry.io/1";

      const res = await getSentryTestRoute(
        new Request("http://localhost/api/sentry-test"),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.eventId).toBeTruthy();
      expect(sentryCaptureMessage).toHaveBeenCalledTimes(1);
      expect(sentryFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe("LIFE-API-001 reference: GET /api/cron/clinic-lifecycle (secret, not session)", () => {
    const previousSecret = process.env.CRON_SECRET;
    const CRON_URL = "http://localhost/api/cron/clinic-lifecycle";

    beforeEach(() => {
      runClinicLifecycleJob.mockClear();
      process.env.CRON_SECRET = "matrix-cron-secret";
    });

    afterEach(() => {
      if (previousSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previousSecret;
      }
    });

    it("thin matrix: no secret → 401, job never runs (full suite = cron-secret-guard)", async () => {
      const res = await getClinicLifecycleCron(
        new Request(CRON_URL, { method: "GET" }),
      );
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: "unauthorized" });
      expect(runClinicLifecycleJob).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Session-gated: unauthenticated → 401 (parameterized)
// Wrong-role + happy already COVERED in finance/privacy/storage suites.
// =============================================================================

describeSecurity("API routes auth matrix — session unauth (FIN/PII)", () => {
  let url: string;
  let anonKey: string;

  beforeEach(() => {
    ({ url, anonKey } = env!);
    activeRouteClient = createSupabaseClient(url, anonKey);
  });

  it.each([
    {
      id: "FIN-API-001 / FILE-SEC-003",
      route: "GET /api/invoices/[invoiceId]/pdf",
      call: () =>
        getInvoicePdfRoute(
          new Request(`http://localhost/api/invoices/${FAKE_UUID}/pdf`),
          { params: Promise.resolve({ invoiceId: FAKE_UUID }) },
        ),
    },
    {
      id: "FIN-API-002",
      route: "GET /api/reports/excel",
      call: () =>
        getExcelReportRoute(
          new Request(
            "http://localhost/api/reports/excel?from=2026-01-01&to=2026-12-31",
          ),
        ),
    },
    {
      id: "PII-API-001",
      route: "GET /api/privacy/patients/[patientId]/export",
      call: () =>
        getPatientExportRoute(
          new Request(
            `http://localhost/api/privacy/patients/${FAKE_UUID}/export`,
          ),
          { params: Promise.resolve({ patientId: FAKE_UUID }) },
        ),
    },
    {
      id: "PII-API-002",
      route: "GET /api/privacy/clinic/export",
      call: () => getClinicExportRoute(),
    },
  ] as const)(
    "$id: $route unauthenticated → 401 unauthorized",
    async ({ call }) => {
      const response = await call();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
    },
  );
});
