import { describe, expect, it } from "vitest";
import { parseLimitsJson } from "@/lib/entitlements/limits";
import { hashInviteToken, createInviteToken } from "@/lib/invites/token";
import { operatorPinSchema } from "@/lib/validations/operator";

describe("parseLimitsJson", () => {
  it("reads numeric plan limits", () => {
    expect(
      parseLimitsJson({
        users: 10,
        doctors: 5,
        locations: 2,
        images_per_patient: 20,
      }),
    ).toEqual({
      users: 10,
      doctors: 5,
      locations: 2,
      images_per_patient: 20,
    });
  });

  it("treats missing/invalid as unlimited (null)", () => {
    expect(parseLimitsJson({})).toEqual({
      users: null,
      doctors: null,
      locations: null,
      images_per_patient: null,
    });
    expect(parseLimitsJson({ users: "10" as unknown as number })).toEqual({
      users: null,
      doctors: null,
      locations: null,
      images_per_patient: null,
    });
  });
});

describe("invite token hash", () => {
  it("hashes deterministically and differs across tokens", () => {
    const a = createInviteToken();
    const b = createInviteToken();
    expect(hashInviteToken(a)).toBe(hashInviteToken(a));
    expect(hashInviteToken(a)).not.toBe(hashInviteToken(b));
    expect(hashInviteToken(a)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("operatorPinSchema", () => {
  it("accepts 4–6 digit PINs only", () => {
    expect(operatorPinSchema.safeParse("1234").success).toBe(true);
    expect(operatorPinSchema.safeParse("123456").success).toBe(true);
    expect(operatorPinSchema.safeParse("12").success).toBe(false);
    expect(operatorPinSchema.safeParse("abcdef").success).toBe(false);
  });
});
