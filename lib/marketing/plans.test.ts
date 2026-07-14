import { describe, expect, it } from "vitest";
import { FEATURE_KEYS } from "@/lib/entitlements/features";
import {
  isProfessionalFeature,
  MARKETING_FEATURE_MATRIX,
  MARKETING_FEATURE_ROWS,
  MARKETING_PLAN_CODES,
  MARKETING_PLANS,
} from "@/lib/marketing/plans";

describe("MARKETING_PLANS", () => {
  it("covers all four PRD plans with VAT monthly prices", () => {
    expect(MARKETING_PLANS.map((p) => p.code)).toEqual([
      "starter",
      "professional",
      "premium_ai",
      "enterprise",
    ]);
    expect(MARKETING_PLANS[0]?.priceMonthly).toBe(15);
    expect(MARKETING_PLANS[1]?.priceMonthly).toBe(25);
    expect(MARKETING_PLANS[2]?.priceMonthly).toBe(35);
    expect(MARKETING_PLANS[3]?.priceMonthly).toBeNull();
    expect(MARKETING_PLANS.filter((p) => p.highlighted)).toHaveLength(1);
    expect(MARKETING_PLANS[1]?.highlighted).toBe(true);
  });

  it("exposes PRD §4.2 limits including images per patient", () => {
    expect(MARKETING_PLANS[0]?.limits).toEqual({
      doctors: 2,
      users: 3,
      locations: 1,
      imagesPerPatient: 10,
    });
    expect(MARKETING_PLANS[1]?.limits.imagesPerPatient).toBe(20);
    expect(MARKETING_PLANS[2]?.limits.imagesPerPatient).toBe(30);
    expect(MARKETING_PLANS[3]?.limits).toMatchObject({
      doctors: null,
      users: null,
      locations: null,
      imagesPerPatient: 40,
    });
  });

  it("lists 5–7 highlight features per plan", () => {
    for (const plan of MARKETING_PLANS) {
      expect(plan.highlightFeatures.length).toBeGreaterThanOrEqual(5);
      expect(plan.highlightFeatures.length).toBeLessThanOrEqual(7);
    }
  });
});

describe("MARKETING_FEATURE_MATRIX", () => {
  it("matches PRD §4.3 feature keys with no missing rows", () => {
    expect(Object.keys(MARKETING_FEATURE_MATRIX).sort()).toEqual(
      [...FEATURE_KEYS].sort(),
    );
    expect(MARKETING_FEATURE_ROWS.map((r) => r.key)).toEqual([...FEATURE_KEYS]);
  });

  it("marks SMS/WhatsApp and AI as metered where PRD requires", () => {
    for (const code of MARKETING_PLAN_CODES) {
      if (code === "starter") {
        expect(MARKETING_FEATURE_MATRIX.sms_whatsapp[code]).toBe("no");
        expect(MARKETING_FEATURE_MATRIX.ai_copilot[code]).toBe("no");
      } else {
        expect(MARKETING_FEATURE_MATRIX.sms_whatsapp[code]).toBe("metered");
      }
    }
    expect(MARKETING_FEATURE_MATRIX.ai_copilot.professional).toBe("no");
    expect(MARKETING_FEATURE_MATRIX.ai_copilot.premium_ai).toBe("metered");
    expect(MARKETING_FEATURE_MATRIX.patient_portal.enterprise).toBe("yes");
    expect(MARKETING_FEATURE_MATRIX.patient_portal.premium_ai).toBe("no");
  });

  it("isProfessionalFeature matches Starter=no / Professional=yes", () => {
    expect(isProfessionalFeature("patients_chart")).toBe(false);
    expect(isProfessionalFeature("branding_custom")).toBe(true);
    expect(isProfessionalFeature("inventory_basic")).toBe(true);
    expect(isProfessionalFeature("ai_copilot")).toBe(false);
    expect(isProfessionalFeature("patient_portal")).toBe(false);
  });
});
