import { describe, expect, it } from "vitest";
import {
  applyFreePeriodOverrides,
  assertCanAddPatientImage,
  BILLING_START,
  FEATURE_KEYS,
  isFeatureKey,
  isFreePeriod2026,
  parseLimitsJson,
  type FeatureFlag,
  type FeatureKey,
} from "@/lib/entitlements";
import { hashInviteToken, createInviteToken } from "@/lib/invites/token";
import { operatorPinSchema } from "@/lib/validations/operator";

function flags(
  overrides: Partial<Record<FeatureKey, boolean>> = {},
): Record<FeatureKey, FeatureFlag> {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [
      key,
      {
        key,
        enabled: overrides[key] ?? true,
        is_metered: key === "sms_whatsapp" || key === "ai_copilot",
      },
    ]),
  ) as Record<FeatureKey, FeatureFlag>;
}

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

describe("free period feature overrides", () => {
  it("disables SMS/AI/portal before billing start", () => {
    const { features, freePeriodOverride } = applyFreePeriodOverrides(
      flags({
        sms_whatsapp: true,
        ai_copilot: true,
        patient_portal: true,
        branding_custom: true,
      }),
      new Date("2026-07-13T00:00:00+02:00"),
    );

    expect(freePeriodOverride).toBe(true);
    expect(features.sms_whatsapp.enabled).toBe(false);
    expect(features.ai_copilot.enabled).toBe(false);
    expect(features.patient_portal.enabled).toBe(false);
    expect(features.branding_custom.enabled).toBe(true);
  });

  it("keeps plan matrix after billing start", () => {
    const { features, freePeriodOverride } = applyFreePeriodOverrides(
      flags({ sms_whatsapp: true, ai_copilot: false }),
      new Date("2027-01-01T00:00:00+01:00"),
    );

    expect(freePeriodOverride).toBe(false);
    expect(features.sms_whatsapp.enabled).toBe(true);
    expect(features.ai_copilot.enabled).toBe(false);
  });

  it("isFreePeriod2026 matches BILLING_START", () => {
    expect(isFreePeriod2026(new Date(BILLING_START.getTime() - 1))).toBe(true);
    expect(isFreePeriod2026(BILLING_START)).toBe(false);
  });
});

describe("isFeatureKey", () => {
  it("accepts known keys only", () => {
    expect(isFeatureKey("invoices")).toBe(true);
    expect(isFeatureKey("not_a_feature")).toBe(false);
  });
});

describe("assertCanAddPatientImage", () => {
  const limits = parseLimitsJson({
    users: 10,
    doctors: 5,
    locations: 2,
    images_per_patient: 20,
  });

  it("allows under limit", () => {
    expect(assertCanAddPatientImage(limits, 19)).toEqual({
      ok: true,
      limits,
      usage: { images: 19 },
    });
  });

  it("hard-blocks at plan cap", () => {
    expect(assertCanAddPatientImage(limits, 20)).toEqual({
      ok: false,
      code: "imageLimit",
      limits,
      usage: { images: 20 },
    });
  });

  it("treats null images_per_patient as unlimited", () => {
    const unlimited = parseLimitsJson({ images_per_patient: null });
    expect(assertCanAddPatientImage(unlimited, 999).ok).toBe(true);
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
