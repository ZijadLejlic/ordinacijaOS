import { describe, expect, it } from "vitest";
import {
  amountForLocale,
  currencyForLocale,
  currencyLabel,
  formatMoney,
  formatSubscriptionPrice,
} from "@/lib/money/format";

describe("currencyForLocale", () => {
  it("uses BAM/KM for Bosnian UI", () => {
    expect(currencyForLocale("bs")).toBe("BAM");
    expect(currencyLabel("bs")).toBe("KM");
  });

  it("uses EUR for other locales", () => {
    expect(currencyForLocale("en")).toBe("EUR");
    expect(currencyForLocale("hr")).toBe("EUR");
    expect(currencyForLocale("sr")).toBe("EUR");
    expect(currencyLabel("en")).toBe("EUR");
  });
});

describe("amountForLocale", () => {
  it("converts EUR→KM at rounded 2× for bs", () => {
    expect(amountForLocale(15, "bs")).toBe(30);
    expect(amountForLocale(25, "bs")).toBe(50);
    expect(amountForLocale(35, "bs")).toBe(70);
    expect(amountForLocale(60, "bs")).toBe(120);
  });

  it("keeps EUR amounts for other locales", () => {
    expect(amountForLocale(15, "en")).toBe(15);
    expect(amountForLocale(25, "hr")).toBe(25);
  });
});

describe("formatMoney", () => {
  it("formats BAM for bs", () => {
    const s = formatMoney(45, "bs");
    expect(s).toMatch(/45/);
    expect(s).toMatch(/KM|BAM/);
  });

  it("formats EUR for en", () => {
    const s = formatMoney(45, "en");
    expect(s).toMatch(/45/);
    expect(s).toMatch(/€|EUR/);
  });

  it("handles null", () => {
    expect(formatMoney(null, "bs")).toBe("—");
  });
});

describe("formatSubscriptionPrice", () => {
  it("shows 15 € as 30 KM for bs", () => {
    const s = formatSubscriptionPrice(15, "bs");
    expect(s).toMatch(/30/);
    expect(s).toMatch(/KM|BAM/);
    expect(s).not.toMatch(/15/);
  });

  it("keeps 15 € for en", () => {
    const s = formatSubscriptionPrice(15, "en");
    expect(s).toMatch(/15/);
    expect(s).toMatch(/€|EUR/);
  });
});
