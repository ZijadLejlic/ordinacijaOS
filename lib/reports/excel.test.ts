import { describe, expect, it } from "vitest";
import { buildFinanceWorkbook } from "@/lib/reports/excel";

describe("buildFinanceWorkbook", () => {
  it("builds a non-empty xlsx buffer", async () => {
    const buffer = await buildFinanceWorkbook({
      clinicName: "Demo Dental",
      generatedAt: "2026-07-13T12:00:00.000Z",
      expenses: [
        {
          date: "2026-07-01",
          category: "supplies",
          description: "Gloves",
          vendor: "MedSupply",
          amount: 40,
          status: "active",
        },
      ],
      payments: [
        {
          paidAt: "2026-07-02 10:00",
          invoiceNumber: "2026-0001",
          method: "cash",
          amount: 100,
          doctorName: "Dr Test",
        },
      ],
      months: [
        { month: "2026-07", revenue: 100, expenses: 40, profit: 60 },
      ],
    });

    expect(buffer.byteLength).toBeGreaterThan(1000);
    // ZIP/XLSX magic
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
