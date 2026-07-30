import { describe, expect, it, afterEach, vi } from "vitest";
import {
  authEmailRedirectUrl,
  authRecoveryConfirmUrl,
  getAppUrl,
} from "@/lib/auth/app-url";

describe("auth app URL helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getAppUrl strips trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.dentord.com/");
    expect(getAppUrl()).toBe("https://www.dentord.com");
  });

  it("getAppUrl returns null when missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getAppUrl()).toBeNull();
  });

  it("authEmailRedirectUrl builds callback with next", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.dentord.com");
    expect(authEmailRedirectUrl("/bs/login")).toBe(
      "https://www.dentord.com/auth/callback?next=%2Fbs%2Flogin",
    );
  });

  it("authEmailRedirectUrl returns null without APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(authEmailRedirectUrl("/bs/login")).toBeNull();
  });

  it("authRecoveryConfirmUrl builds confirm URL with token_hash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.dentord.com");
    expect(authRecoveryConfirmUrl("abc123", "/bs/reset-password")).toBe(
      "https://www.dentord.com/auth/confirm?token_hash=abc123&type=recovery&next=%2Fbs%2Freset-password",
    );
  });
});
