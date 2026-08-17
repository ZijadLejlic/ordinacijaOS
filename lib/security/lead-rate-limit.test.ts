import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";
import {
  createSupabaseClient,
  randomTag,
  type DbClient,
} from "@/lib/security/factories";
import { hashIp, RATE_LIMIT_PER_HOUR } from "@/lib/leads/rate-limit";

/**
 * P5.3 (docs/QA/Implementation-Plan.md): lead rate limit + honeypot INT.
 * Closes `MKT-INT-001`; reinforces `MKT-SEC-002` at SA boundary / W13 / T-AVL-01.
 *
 * **Mechanism (grepped, not assumed):**
 * - `submitLeadAction` (`lib/leads/actions.ts`): filled `website`/`company`
 *   honeypot → `{ ok: true }` **without** INSERT/email (silent bot success —
 *   not Zod reject; Zod path = `MKT-UNIT-003`). SEO/indexing copy and
 *   lookalike `@search-dentord.com` mail → same silent drop (`detectLeadSpam`,
 *   `MKT-UNIT-004`). Else service-role count of `leads` with same `ip_hash`
 *   in last hour; if `count >= RATE_LIMIT_PER_HOUR` (5) → `rateLimited`. IP
 *   from `x-forwarded-for` / `x-real-ip` via `getRequestIp`; stored as
 *   `hashIp` only.
 * - Leads table deny-all for anon/auth = `MKT-SEC-001` (already COVERED).
 *
 * Pattern: mock `createServiceClient` + `next/headers` + Resend; real SA.
 */

const env = getSecurityTestEnv();
const describeSecurity = env ? describe : describe.skip;

const TEST_IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
const TEST_SALT = `lead-int-${randomTag()}`;

let headerStore: Record<string, string> = {
  "x-forwarded-for": TEST_IP,
};

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerStore[name.toLowerCase()] ?? null,
  }),
}));

let serviceForActions: DbClient;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => serviceForActions,
}));

vi.mock("@/lib/email/resend", () => ({
  sendLeadNotificationEmail: async () => ({ id: "mock-lead-resend" }),
}));

import { submitLeadAction } from "@/lib/leads/actions";

function leadForm(opts?: {
  website?: string;
  company?: string;
  name?: string;
  email?: string;
  message?: string;
}): FormData {
  const tag = randomTag().slice(-6);
  const fd = new FormData();
  fd.set("name", opts?.name ?? `Lead ${tag}`);
  fd.set("clinicName", `Clinic ${tag}`);
  fd.set("phone", "+38761123456");
  fd.set("email", opts?.email ?? `lead-${tag}@ordinacijaos.test`);
  fd.set("preferredTime", "anytime");
  fd.set("message", opts?.message ?? "");
  fd.set("gdpr", "on");
  fd.set("locale", "bs");
  fd.set("sourcePage", "contact");
  fd.set("website", opts?.website ?? "");
  fd.set("company", opts?.company ?? "");
  return fd;
}

describeSecurity("P5.3 lead rate limit + honeypot (MKT-INT-001/SEC-002)", () => {
  let service: DbClient;
  let ipHash: string;
  const insertedIds: string[] = [];

  beforeAll(() => {
    process.env.LEAD_IP_HASH_SALT = TEST_SALT;
    const { url, serviceKey } = env!;
    service = createSupabaseClient(url, serviceKey);
    serviceForActions = service;
    ipHash = hashIp(TEST_IP);
  });

  afterAll(async () => {
    if (service && insertedIds.length > 0) {
      await service.from("leads").delete().in("id", insertedIds);
    }
    // Safety net: any leftover with this test hash.
    if (service && ipHash) {
      await service.from("leads").delete().eq("ip_hash", ipHash);
    }
  }, 60_000);

  it("MKT-SEC-002 SA: filled honeypot → silent ok, no lead row", async () => {
    const before = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);

    const result = await submitLeadAction(
      null,
      leadForm({ website: "https://bot.example" }),
    );
    expect(result).toEqual({ ok: true });

    const after = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);
    expect(after.count ?? 0).toBe(before.count ?? 0);
  }, 30_000);

  it("MKT-SEC-002 SA: company honeypot → silent ok, no lead row", async () => {
    const before = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);

    const result = await submitLeadAction(
      null,
      leadForm({ company: "Bot Corp" }),
    );
    expect(result).toEqual({ ok: true });

    const after = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);
    expect(after.count ?? 0).toBe(before.count ?? 0);
  }, 30_000);

  it("MKT-INT-003: SEO indexing pitch → silent ok, no lead row", async () => {
    const before = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);

    const result = await submitLeadAction(
      null,
      leadForm({
        name: "Antonietta",
        email: "domains@search-dentord.com",
        message:
          "Feature dentord.com in Google's Search Index! helpindex.org",
      }),
    );
    expect(result).toEqual({ ok: true });

    const after = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);
    expect(after.count ?? 0).toBe(before.count ?? 0);
  }, 30_000);

  it("MKT-INT-001: 5 leads/hour same IP OK; 6th rateLimited", async () => {
    expect(RATE_LIMIT_PER_HOUR).toBe(5);

    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      const result = await submitLeadAction(null, leadForm());
      expect(result).toEqual({ ok: true });
    }

    const { data: rows } = await service
      .from("leads")
      .select("id")
      .eq("ip_hash", ipHash);
    expect(rows?.length).toBe(RATE_LIMIT_PER_HOUR);
    insertedIds.push(...(rows ?? []).map((r) => r.id));

    const blocked = await submitLeadAction(null, leadForm());
    expect(blocked).toEqual({ error: "rateLimited" });

    const { count } = await service
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);
    expect(count).toBe(RATE_LIMIT_PER_HOUR);

    // Different IP still accepted while this IP is limited.
    headerStore = { "x-forwarded-for": "198.51.100.50" };
    const other = await submitLeadAction(null, leadForm({ name: "Other IP" }));
    expect(other).toEqual({ ok: true });

    const otherHash = hashIp("198.51.100.50");
    const { data: otherRows } = await service
      .from("leads")
      .select("id")
      .eq("ip_hash", otherHash)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(otherRows?.[0]?.id).toBeTruthy();
    if (otherRows?.[0]?.id) insertedIds.push(otherRows[0].id);

    headerStore = { "x-forwarded-for": TEST_IP };
  }, 60_000);
});
