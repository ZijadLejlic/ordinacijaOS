import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsProps } from "@/lib/analytics/posthog";

/**
 * P6a — PII-SEC-001 (D33): PostHog / analytics event payloads must not
 * carry patient names or other PII keys.
 *
 * **Mechanism (read, not invented):**
 * `lib/analytics/posthog.ts` — `trackEvent` passes props through
 * `sanitizeAnalyticsProps`, which drops keys matching
 * `/name|email|phone|patient|address|jmbg|oib|iban/i` before
 * `posthog.capture`. `identifyClinicUser` only sets `clinic_id` + `role`
 * (never patient fields).
 *
 * Prefer unit + static call-site audit over a live PostHog network call.
 * Assert on prop **keys** only — never echo patient-name values in output.
 */

/** Known production `trackEvent(` call sites (grepped; keep in sync). */
const TRACK_EVENT_CALL_SITES = [
  "components/marketing/demo/demo-live-cta.tsx",
  "components/marketing/tour/tour-experience.tsx",
] as const;

/** Keys that must never appear in analytics props (D33 + sanitize denylist). */
const FORBIDDEN_PROP_KEY =
  /\b(?:first_name|last_name|full_name|patient_name|patient_id|email|phone|jmbg|oib|iban|address)\b/i;

describe("analytics PII sanitize (D33 / PII-SEC-001)", () => {
  it("keeps clinic_id / role / feature keys and strips PII-ish keys", () => {
    const cleaned = sanitizeAnalyticsProps({
      clinic_id: "clinic-uuid",
      role: "doctor",
      chapter: "calendar",
      count: 3,
      // Forbidden keys — values are synthetic placeholders, not real PII.
      patient_name: "REDACTED",
      first_name: "REDACTED",
      last_name: "REDACTED",
      full_name: "REDACTED",
      email: "redacted@example.test",
      phone: "+000",
      patient_id: "uuid-should-drop",
      address: "REDACTED",
      jmbg: "000",
      oib: "000",
      iban: "XX00",
    });

    expect(cleaned).toEqual({
      clinic_id: "clinic-uuid",
      role: "doctor",
      chapter: "calendar",
      count: 3,
    });
    for (const key of Object.keys(cleaned)) {
      expect(FORBIDDEN_PROP_KEY.test(key)).toBe(false);
    }
  });

  it("returns empty object for undefined / empty props", () => {
    expect(sanitizeAnalyticsProps(undefined)).toEqual({});
    expect(sanitizeAnalyticsProps({})).toEqual({});
  });

  it("identifyClinicUser source only assigns clinic_id and role", () => {
    const src = readFileSync(
      resolve(process.cwd(), "lib/analytics/posthog.ts"),
      "utf8",
    );
    const identifyBody = src.slice(
      src.indexOf("export function identifyClinicUser"),
      src.indexOf("client.group("),
    );
    expect(identifyBody).toMatch(/clinic_id:\s*input\.clinicId/);
    expect(identifyBody).toMatch(/role:\s*input\.role/);
    expect(identifyBody).not.toMatch(/first_name|last_name|full_name|patient/i);
  });

  it("trackEvent call sites do not pass forbidden prop keys", () => {
    for (const relative of TRACK_EVENT_CALL_SITES) {
      const src = readFileSync(resolve(process.cwd(), relative), "utf8");
      expect(src, relative).toMatch(/trackEvent\s*\(/);
      // Strip string literals so names inside UI copy don't false-positive.
      const withoutStrings = src.replace(/(["'`])(?:\\.|(?!\1).)*\1/gs, '""');
      expect(withoutStrings, relative).not.toMatch(
        /trackEvent\s*\(\s*[^,]+,\s*\{[^}]*(?:first_name|last_name|full_name|patient_name|email|phone|jmbg|oib|iban)\s*:/i,
      );
    }
  });
});
