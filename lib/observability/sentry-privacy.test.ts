import { describe, expect, it } from "vitest";
import {
  isExpectedBusinessError,
  sanitizeSentryEvent,
} from "@/lib/observability/sentry-privacy";
import { captureUnexpectedError } from "@/lib/observability/sentry";

describe("Sentry privacy / expected-error filters (D33)", () => {
  it("treats invalid credentials / overlap / 401 as expected", () => {
    expect(isExpectedBusinessError(new Error("invalidCredentials"))).toBe(true);
    expect(isExpectedBusinessError(new Error("appointment overlap"))).toBe(true);
    expect(isExpectedBusinessError({ status: 401, message: "nope" })).toBe(true);
    expect(isExpectedBusinessError({ status: 403, message: "nope" })).toBe(true);
    expect(isExpectedBusinessError(new Error("Unexpected DB failure"))).toBe(
      false,
    );
  });

  it("scrubs cookies, auth headers, and body from events", () => {
    const event = {
      type: undefined,
      message: "boom",
      user: { id: "u1", email: "leak@example.test", username: "doc" },
      request: {
        cookies: { sb: "token" },
        headers: {
          Authorization: "Bearer secret",
          "content-type": "application/json",
        },
        data: { password: "x", patient_name: "REDACTED" },
      },
      extra: {
        clinic_id: "c1",
        patient_name: "REDACTED",
        email: "leak@example.test",
      },
    };

    const cleaned = sanitizeSentryEvent(event as never, {} as never);
    expect(cleaned).not.toBeNull();
    expect(cleaned!.user).toEqual({ id: "u1" });
    expect(cleaned!.request?.cookies).toEqual({});
    expect(cleaned!.request?.data).toBe("[Filtered]");
    expect(cleaned!.request?.headers?.Authorization).toBe("[Filtered]");
    expect(cleaned!.request?.headers?.["content-type"]).toBe(
      "application/json",
    );
    expect(cleaned!.extra?.clinic_id).toBe("c1");
    expect(cleaned!.extra?.patient_name).toBe("[Filtered]");
    expect(cleaned!.extra?.email).toBe("[Filtered]");
  });

  it("drops expected business errors in beforeSend", () => {
    const event = {
      type: undefined,
      message: "invalid credentials",
    };
    expect(
      sanitizeSentryEvent(event as never, {
        originalException: new Error("invalidCredentials"),
      } as never),
    ).toBeNull();
  });

  it("captureUnexpectedError skips expected errors", () => {
    const id = captureUnexpectedError(new Error("invalidCredentials"), {
      feature: "auth",
      operation: "login",
    });
    expect(id).toBeUndefined();
  });
});
