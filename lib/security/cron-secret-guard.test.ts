import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P1.10 (docs/QA/Implementation-Plan.md): closes `LIFE-API-001` / Threat-Model
 * `T-PLAT-04` / AC6 ("Attacker hits `/api/cron/clinic-lifecycle` without
 * secret → mass pending_delete/hard delete. Must fail auth on route.").
 *
 * **Mechanism found (read before writing a single assertion):**
 * `app/api/cron/clinic-lifecycle/route.ts` reads `process.env.CRON_SECRET`
 * once, then:
 *   1. env unset / empty → **500** `{ error: "CRON_SECRET not configured" }`
 *      (fail-closed — never reaches the job; not a fail-open)
 *   2. env set, but neither `Authorization: Bearer <secret>` nor
 *      `?secret=<secret>` matches → **401** `{ error: "unauthorized" }`
 *   3. either Bearer **or** `?secret=` matches (OR, not AND) → calls
 *      `runClinicLifecycleJob()` and returns **200** with counts
 *
 * Threat-Model's "Bearer/`?secret=`" wording is accurate — the route accepts
 * both (Bearer is the production path for Vercel Cron; `?secret=` is
 * documented in the route comment as a local smoke-test convenience).
 * `scripts/check-production-ops.mjs` already probes the live production
 * route without a secret and expects `401` — this file is the hermetic
 * counterpart of that same gate, without a network hop.
 *
 * **Why mock `lifecycle-job.ts` (and stay in `test:unit`):** the auth gate
 * is entirely in the route handler and does not touch Supabase. The job
 * itself (`runClinicLifecycleJob`) uses the service-role client to run
 * irreversible lifecycle transitions + `hard_delete_clinic` — that
 * behaviour belongs to `LIFE-INT-002` (still GAP, out of this ID's scope).
 * Mocking the job isolates "does the gate reject?" from "do the
 * transitions work?" and keeps this Critical check DB-free / every-PR.
 * The mock also lets us assert the job is **never** invoked on the
 * reject paths — the actual AC6 property, not just the status code.
 *
 * Pattern mirrors P1.2's FILE-SEC-003 (call an app/api/.../route.ts GET
 * handler directly with a Request), except this route does not use
 * @/lib/supabase/server at all — only the lifecycle job — so the only
 * mock needed is that job module.
 */

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

// Textually after the `vi.mock` above on purpose (Vitest hoists `vi.mock`
// calls above all imports regardless of source position, but keeping this
// import below it documents the dependency for human readers).
import { GET as getClinicLifecycleCron } from "@/app/api/cron/clinic-lifecycle/route";

const CRON_URL = "http://localhost/api/cron/clinic-lifecycle";
const REAL_SECRET = "test-cron-secret-p1-10";

function request(
  init?: { bearer?: string | null; secretQuery?: string | null },
): Request {
  const url = new URL(CRON_URL);
  if (init?.secretQuery != null) {
    url.searchParams.set("secret", init.secretQuery);
  }
  const headers = new Headers();
  if (init?.bearer != null) {
    headers.set("authorization", `Bearer ${init.bearer}`);
  }
  return new Request(url, { method: "GET", headers });
}

describe("clinic-lifecycle cron secret gate (LIFE-API-001 / AC6)", () => {
  const previousSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    runClinicLifecycleJob.mockClear();
    process.env.CRON_SECRET = REAL_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  });

  it("fail-closed: missing CRON_SECRET env → 500, job never runs", async () => {
    delete process.env.CRON_SECRET;

    const res = await getClinicLifecycleCron(request());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "CRON_SECRET not configured" });
    expect(runClinicLifecycleJob).not.toHaveBeenCalled();
  });

  it("fail-closed: empty CRON_SECRET env → 500, job never runs", async () => {
    // `if (!secret)` treats "" the same as unset — document that explicitly
    // so a future rewrite to truthy-only checks can't silently fail-open.
    process.env.CRON_SECRET = "";

    const res = await getClinicLifecycleCron(request());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "CRON_SECRET not configured" });
    expect(runClinicLifecycleJob).not.toHaveBeenCalled();
  });

  it("no Authorization header and no ?secret= → 401, job never runs", async () => {
    const res = await getClinicLifecycleCron(request());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "unauthorized" });
    expect(runClinicLifecycleJob).not.toHaveBeenCalled();
  });

  it("wrong Bearer value → 401, job never runs", async () => {
    const res = await getClinicLifecycleCron(
      request({ bearer: "wrong-secret" }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "unauthorized" });
    expect(runClinicLifecycleJob).not.toHaveBeenCalled();
  });

  it("wrong ?secret= query → 401, job never runs", async () => {
    const res = await getClinicLifecycleCron(
      request({ secretQuery: "wrong-secret" }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "unauthorized" });
    expect(runClinicLifecycleJob).not.toHaveBeenCalled();
  });

  it("non-Bearer Authorization scheme is ignored → 401", async () => {
    // Route only strips a leading "Bearer " prefix; anything else leaves
    // bearer=null, so a Basic/raw token must not authenticate.
    const headers = new Headers({ authorization: `Basic ${REAL_SECRET}` });
    const res = await getClinicLifecycleCron(
      new Request(CRON_URL, { method: "GET", headers }),
    );

    expect(res.status).toBe(401);
    expect(runClinicLifecycleJob).not.toHaveBeenCalled();
  });

  it("correct Bearer → 200 and job runs once", async () => {
    const res = await getClinicLifecycleCron(
      request({ bearer: REAL_SECRET }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      markedReadonly: 0,
      markedPendingDelete: 0,
      deleted: [],
    });
    expect(runClinicLifecycleJob).toHaveBeenCalledTimes(1);
  });

  it("correct ?secret= query → 200 and job runs once", async () => {
    const res = await getClinicLifecycleCron(
      request({ secretQuery: REAL_SECRET }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(runClinicLifecycleJob).toHaveBeenCalledTimes(1);
  });

  it("correct Bearer wins even when ?secret= is wrong (OR semantics)", async () => {
    // Documents the actual OR check — Threat-Model says "Bearer/?secret=",
    // and a future AND rewrite would break the documented Vercel Cron path
    // if someone also left a stale query param on the URL.
    const res = await getClinicLifecycleCron(
      request({ bearer: REAL_SECRET, secretQuery: "wrong" }),
    );

    expect(res.status).toBe(200);
    expect(runClinicLifecycleJob).toHaveBeenCalledTimes(1);
  });

  it("job throw surfaces as 500 after auth passed (auth gate already cleared)", async () => {
    runClinicLifecycleJob.mockRejectedValueOnce(new Error("job_boom"));

    const res = await getClinicLifecycleCron(
      request({ bearer: REAL_SECRET }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "job_boom" });
    expect(runClinicLifecycleJob).toHaveBeenCalledTimes(1);
  });
});
