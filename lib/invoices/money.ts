/** Money helpers — prices are gross (with VAT); vat_rate is 0–1 fraction. */

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineVatFromGross(gross: number, vatRate: number): number {
  if (vatRate <= 0) return 0;
  return roundMoney(gross - gross / (1 + vatRate));
}

export function lineNetFromGross(gross: number, vatRate: number): number {
  return roundMoney(gross - lineVatFromGross(gross, vatRate));
}

export function formatInvoiceNumber(
  seriesYear: number,
  seriesNumber: number,
): string {
  return `${seriesYear}-${String(seriesNumber).padStart(4, "0")}`;
}

export function invoiceStoragePath(
  clinicId: string,
  patientId: string,
  invoiceId: string,
): string {
  return `${clinicId}/${patientId}/invoices/${invoiceId}.pdf`;
}
