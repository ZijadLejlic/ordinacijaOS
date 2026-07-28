import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P6b — AUTH-INT-021 (D12): session TTL = 7 days asserted in checked-in
 * Auth config (ops/INT). Does **not** invent a GoTrue Admin API probe.
 *
 * **Mechanism (read, not invented):**
 * `supabase/config.toml` (P0.2):
 *   - `[auth] jwt_expiry = 604800` (7d access-token max)
 *   - `[auth.sessions] timebox = "168h"` (hard session cutoff)
 * Hosted dashboard must mirror these — documented in
 * `docs/Production-Ops.md` § Auth session TTL.
 *
 * DB-free unit (runs under `test:unit` + `test:security`).
 */

const SEVEN_DAYS_SECONDS = 604_800;
const SEVEN_DAYS_TIMEBOX = "168h";

function readAuthToml(): string {
  return readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");
}

describe("AUTH-INT-021 session TTL config matches D12 (7 days)", () => {
  it("AUTH-INT-021: jwt_expiry = 604800 (7d)", () => {
    const toml = readAuthToml();
    // Match the assignment under [auth], not a commented example.
    const match = toml.match(/^\s*jwt_expiry\s*=\s*(\d+)\s*$/m);
    expect(match, "jwt_expiry must be set in supabase/config.toml").not.toBeNull();
    expect(Number(match![1])).toBe(SEVEN_DAYS_SECONDS);
  });

  it("AUTH-INT-021: [auth.sessions] timebox = 168h", () => {
    const toml = readAuthToml();
    expect(toml).toMatch(/\[auth\.sessions\]/);
    const match = toml.match(/^\s*timebox\s*=\s*"([^"]+)"\s*$/m);
    expect(match, "timebox must be set under [auth.sessions]").not.toBeNull();
    expect(match![1]).toBe(SEVEN_DAYS_TIMEBOX);
  });
});
