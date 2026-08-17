import { describe, expect, it } from "vitest";
import { detectLeadSpam, isLeadSubmittedTooFast } from "@/lib/leads/spam";

const legit = {
  name: "Amina Hodžić",
  clinicName: "Smile Dent",
  email: "amina@smiledent.ba",
  message: "Zanima me demo za dvije stolice",
};

describe("detectLeadSpam", () => {
  it("allows a normal BA callback request", () => {
    expect(detectLeadSpam(legit)).toBeNull();
    expect(
      detectLeadSpam({ ...legit, email: "", message: "" }),
    ).toBeNull();
  });

  it("drops helpindex / search-dentord indexing spam", () => {
    expect(
      detectLeadSpam({
        name: "Antonietta",
        clinicName: "Antonietta Encarnacion",
        email: "domains@search-dentord.com",
        message:
          "Feature dentord.com in Google's Search Index and have it appear in web search results! Feature dentord.com today: helpindex.org",
      }),
    ).toEqual({ reason: "spam_host" });

    expect(
      detectLeadSpam({
        name: "Angela",
        clinicName: "Angela Chapin",
        email: "hello@get-dentord.xyz",
        message: "Molim vas da me pozovete",
      }),
    ).toEqual({ reason: "lookalike_email" });
  });

  it("drops SEO outreach that pastes http links", () => {
    expect(
      detectLeadSpam({
        name: "Alice",
        clinicName: "Alice",
        email: "alice.seoexpert02@gmail.com",
        message:
          "Hello http://dentord.com, I found a few SEO improvements that could help your website.",
      }),
    ).toEqual({ reason: "url" });
  });

  it("does not treat dentord.com staff mail as lookalike", () => {
    expect(
      detectLeadSpam({
        ...legit,
        email: "hello@dentord.com",
      }),
    ).toBeNull();
  });

  it("treats instant formTs as a bot", () => {
    expect(isLeadSubmittedTooFast("")).toBe(false);
    expect(isLeadSubmittedTooFast(String(Date.now()))).toBe(true);
    expect(isLeadSubmittedTooFast(String(Date.now() - 5_000))).toBe(false);
  });
});
