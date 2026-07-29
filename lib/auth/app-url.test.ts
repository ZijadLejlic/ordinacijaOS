import { describe, expect, it, afterEach, vi } from "vitest";
import { authEmailRedirectUrl, getAppUrl } from "@/lib/auth/app-url";

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
});
