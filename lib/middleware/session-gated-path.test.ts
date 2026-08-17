import { describe, expect, it } from "vitest";
import { isSessionGatedPath } from "@/lib/middleware/session-gated-path";

describe("isSessionGatedPath", () => {
  it("leaves marketing public (no Supabase getUser)", () => {
    for (const path of [
      "/",
      "/pricing",
      "/features",
      "/contact",
      "/blog",
      "/blog/why-cloud",
      "/privacy",
      "/faq",
    ]) {
      expect(isSessionGatedPath(path), path).toBe(false);
    }
  });

  it("gates clinic, auth, platform, and recovery", () => {
    for (const path of [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/dashboard",
      "/patients/abc",
      "/settings/users",
      "/platform",
      "/platform/clinics/x",
      "/onboarding",
      "/pin",
      "/mfa/enroll",
      "/invite/token",
    ]) {
      expect(isSessionGatedPath(path), path).toBe(true);
    }
  });
});
