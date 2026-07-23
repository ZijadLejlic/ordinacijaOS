import { describe, expect, it } from "vitest";
import { getSecurityTestEnv } from "@/lib/security/test-env";

// P0.8 (docs/QA/Implementation-Plan.md) / D-15 (docs/QA/Discrepancies.md):
// the security suite must fail closed — not silently skip — when
// SECURITY_TESTS_REQUIRED=1 and the DB env isn't actually configured.
//
// Every case here passes an explicit `source` object rather than mutating
// `process.env`, so this stays a pure unit test with zero dependency on
// `.env.local` / real Supabase config and can run under `test:unit`.
describe("getSecurityTestEnv (P0.8 fail-closed gate)", () => {
  const fullEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  };

  it("returns null when env is missing and SECURITY_TESTS_REQUIRED is unset (local dev: clean skip)", () => {
    expect(getSecurityTestEnv({})).toBeNull();
  });

  it("returns null when env is missing and SECURITY_TESTS_REQUIRED=0", () => {
    expect(
      getSecurityTestEnv({ SECURITY_TESTS_REQUIRED: "0" }),
    ).toBeNull();
  });

  it("throws when SECURITY_TESTS_REQUIRED=1 and every var is missing", () => {
    expect(() => getSecurityTestEnv({ SECURITY_TESTS_REQUIRED: "1" })).toThrow(
      /SECURITY_TESTS_REQUIRED=1 but the security test suite would skip/,
    );
  });

  it("throws when SECURITY_TESTS_REQUIRED=1 and only one var is missing, naming it", () => {
    expect(() =>
      getSecurityTestEnv({
        ...fullEnv,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SECURITY_TESTS_REQUIRED: "1",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("does not throw when all vars are present, even if SECURITY_TESTS_REQUIRED=1", () => {
    expect(() =>
      getSecurityTestEnv({ ...fullEnv, SECURITY_TESTS_REQUIRED: "1" }),
    ).not.toThrow();
  });

  it("returns the mapped {url, anonKey, serviceKey} when all vars are present", () => {
    expect(getSecurityTestEnv(fullEnv)).toEqual({
      url: fullEnv.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: fullEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: fullEnv.SUPABASE_SERVICE_ROLE_KEY,
    });
  });
});
