import { describe, expect, it } from "vitest";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { parseImpersonationCookie } from "@/lib/platform/session";

describe("isPlatformAdmin", () => {
  it("accepts app_metadata flag only", () => {
    expect(
      isPlatformAdmin({ app_metadata: { is_platform_admin: true } }),
    ).toBe(true);
    expect(
      isPlatformAdmin({ app_metadata: { is_platform_admin: false } }),
    ).toBe(false);
    expect(isPlatformAdmin({ app_metadata: {} })).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it("does not treat other truthy values as admin", () => {
    expect(
      isPlatformAdmin({ app_metadata: { is_platform_admin: "true" } }),
    ).toBe(false);
    expect(
      isPlatformAdmin({ app_metadata: { is_platform_admin: 1 } }),
    ).toBe(false);
  });
});

describe("parseImpersonationCookie", () => {
  const valid = {
    adminUserId: "11111111-1111-4111-8111-111111111111",
    adminEmail: "admin@example.com",
    clinicId: "22222222-2222-4222-8222-222222222222",
    targetUserId: "33333333-3333-4333-8333-333333333333",
    startedAt: "2026-07-13T10:00:00.000Z",
  };

  it("parses a valid payload", () => {
    expect(parseImpersonationCookie(JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects malformed payloads", () => {
    expect(parseImpersonationCookie(null)).toBeNull();
    expect(parseImpersonationCookie("{")).toBeNull();
    expect(
      parseImpersonationCookie(
        JSON.stringify({ ...valid, adminUserId: "not-a-uuid" }),
      ),
    ).toBeNull();
  });
});
