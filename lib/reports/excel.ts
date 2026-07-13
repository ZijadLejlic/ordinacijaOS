import ExcelJS from "exceljs";
import { PRODUCT_NAME } from "@/lib/brand/constants";
import { roundMoney } from "@/lib/invoices/money";

export type ExcelExpenseRow = {
  date: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
  status: string;
};

export type ExcelPaymentRow = {
  paidAt: string;
  invoiceNumber: string;
  method: string;
  amount: number;
  doctorName: string;
};

export type ExcelMonthRow = {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
};

export async function buildFinanceWorkbook(opts: {
  clinicName: string;
  generatedAt: string;
  expenses: ExcelExpenseRow[];
  payments: ExcelPaymentRow[];
  months: ExcelMonthRow[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = PRODUCT_NAME;
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Profit");
  summary.columns = [
    { header: "Month", key: "month", width: 12 },
    { header: "Revenue EUR", key: "revenue", width: 14 },
    { header: "Expenses EUR", key: "expenses", width: 14 },
    { header: "Profit EUR", key: "profit", width: 14 },
  ];
  for (const row of opts.months) {
    summary.addRow(row);
  }
  const totalRevenue = roundMoney(
    opts.months.reduce((a, m) => a + m.revenue, 0),
  );
  const totalExpenses = roundMoney(
    opts.months.reduce((a, m) => a + m.expenses, 0),
  );
  summary.addRow({
    month: "TOTAL",
    revenue: totalRevenue,
    expenses: totalExpenses,
    profit: roundMoney(totalRevenue - totalExpenses),
  });
  summary.getRow(1).font = { bold: true };

  const expensesSheet = workbook.addWorksheet("Expenses");
  expensesSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Category", key: "category", width: 14 },
    { header: "Description", key: "description", width: 36 },
    { header: "Vendor", key: "vendor", width: 20 },
    { header: "Amount EUR", key: "amount", width: 14 },
    { header: "Status", key: "status", width: 10 },
  ];
  for (const row of opts.expenses) {
    expensesSheet.addRow(row);
  }
  expensesSheet.getRow(1).font = { bold: true };

  const paymentsSheet = workbook.addWorksheet("Payments");
  paymentsSheet.columns = [
    { header: "Paid at", key: "paidAt", width: 20 },
    { header: "Invoice", key: "invoiceNumber", width: 12 },
    { header: "Method", key: "method", width: 14 },
    { header: "Amount EUR", key: "amount", width: 14 },
    { header: "Doctor", key: "doctorName", width: 22 },
  ];
  for (const row of opts.payments) {
    paymentsSheet.addRow(row);
  }
  paymentsSheet.getRow(1).font = { bold: true };

  const meta = workbook.addWorksheet("Meta");
  meta.addRow(["Clinic", opts.clinicName]);
  meta.addRow(["Generated at", opts.generatedAt]);
  meta.addRow(["Currency", "EUR"]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
