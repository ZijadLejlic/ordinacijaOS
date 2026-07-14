import { describe, expect, it } from "vitest";
import { submitLeadSchema } from "@/lib/validations/lead";

describe("submitLeadSchema", () => {
  const valid = {
    name: "Amina Hodžić",
    clinicName: "Smile Dent",
    phone: "+387 61 123 456",
    email: "amina@example.com",
    preferredTime: "morning" as const,
    message: "Zanima me demo",
    gdpr: "on" as const,
    locale: "bs" as const,
    sourcePage: "contact",
    website: "",
  };

  it("accepts a valid lead", () => {
    const result = submitLeadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts empty optional email and message", () => {
    const result = submitLeadSchema.safeParse({
      ...valid,
      email: "",
      message: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short name", () => {
    const result = submitLeadSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects missing GDPR consent", () => {
    const result = submitLeadSchema.safeParse({
      ...valid,
      gdpr: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects filled honeypot", () => {
    const result = submitLeadSchema.safeParse({
      ...valid,
      website: "http://spam.example",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid preferred time", () => {
    const result = submitLeadSchema.safeParse({
      ...valid,
      preferredTime: "evening",
    });
    expect(result.success).toBe(false);
  });
});
