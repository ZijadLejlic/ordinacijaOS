import { describe, expect, it } from "vitest";
import {
  formatInvoiceNumber,
  lineNetFromGross,
  lineVatFromGross,
  roundMoney,
} from "@/lib/invoices/money";

describe("invoice money", () => {
  it("splits gross into net + vat", () => {
    const gross = 117;
    const vatRate = 0.17;
    expect(lineVatFromGross(gross, vatRate)).toBe(17);
    expect(lineNetFromGross(gross, vatRate)).toBe(100);
    expect(
      roundMoney(
        lineNetFromGross(gross, vatRate) + lineVatFromGross(gross, vatRate),
      ),
    ).toBe(117);
  });

  it("formats YYYY-####", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("2026-0001");
    expect(formatInvoiceNumber(2026, 42)).toBe("2026-0042");
  });
});
