import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Image,
} from "@react-pdf/renderer";
import { formatInvoiceNumber, roundMoney } from "@/lib/invoices/money";
import { ensurePdfFonts, PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import {
  formatMoney,
  type DisplayCurrency,
} from "@/lib/money/format";

export type InvoicePdfLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
};

export type InvoicePdfData = {
  clinicName: string;
  legalName: string | null;
  taxId: string | null;
  logoUrl: string | null;
  patientName: string;
  seriesYear: number;
  seriesNumber: number;
  issuedAt: string;
  currency: DisplayCurrency;
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  notes: string | null;
  lines: InvoicePdfLine[];
  locale: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: PDF_FONT_FAMILY,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  logo: { width: 72, height: 72, objectFit: "contain" },
  title: {
    fontSize: 18,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: { color: "#555555", marginBottom: 2 },
  section: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eeeeee",
  },
  colDesc: { width: "40%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colVat: { width: "12%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 24,
    marginBottom: 2,
  },
  totalLabel: { width: 100, textAlign: "right", color: "#555555" },
  totalValue: { width: 80, textAlign: "right" },
  grandTotal: {
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
    fontSize: 12,
  },
  bold: {
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
    marginBottom: 2,
  },
});

function money(n: number, currency: DisplayCurrency, locale: string) {
  return formatMoney(n, locale, currency);
}

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const number = formatInvoiceNumber(data.seriesYear, data.seriesNumber);
  const issued = new Date(data.issuedAt).toLocaleDateString(
    data.locale === "bs" ? "bs-BA" : "en-GB",
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              {data.locale === "bs" ? "Faktura" : "Invoice"} {number}
            </Text>
            <Text style={styles.muted}>
              {data.locale === "bs" ? "Datum" : "Date"}: {issued}
            </Text>
            <Text style={styles.muted}>
              {data.clinicName}
              {data.legalName ? ` · ${data.legalName}` : ""}
            </Text>
            {data.taxId ? (
              <Text style={styles.muted}>
                {data.locale === "bs" ? "Poreski ID" : "Tax ID"}: {data.taxId}
              </Text>
            ) : null}
          </View>
          {data.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
            <Image src={data.logoUrl} style={styles.logo} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>
            {data.locale === "bs" ? "Pacijent" : "Patient"}
          </Text>
          <Text>{data.patientName}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>
            {data.locale === "bs" ? "Opis" : "Description"}
          </Text>
          <Text style={styles.colQty}>
            {data.locale === "bs" ? "Kol." : "Qty"}
          </Text>
          <Text style={styles.colPrice}>
            {data.locale === "bs" ? "Cijena" : "Price"}
          </Text>
          <Text style={styles.colVat}>PDV</Text>
          <Text style={styles.colTotal}>
            {data.locale === "bs" ? "Ukupno" : "Total"}
          </Text>
        </View>

        {data.lines.map((line, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.colDesc}>{line.description}</Text>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colPrice}>
              {money(line.unitPrice, data.currency, data.locale)}
            </Text>
            <Text style={styles.colVat}>
              {roundMoney(line.vatRate * 100)}%
            </Text>
            <Text style={styles.colTotal}>
              {money(line.lineTotal, data.currency, data.locale)}
            </Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {data.locale === "bs" ? "Osnovica" : "Subtotal"}
            </Text>
            <Text style={styles.totalValue}>
              {money(data.subtotalAmount, data.currency, data.locale)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>PDV</Text>
            <Text style={styles.totalValue}>
              {money(data.vatAmount, data.currency, data.locale)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.grandTotal]}>
              {data.locale === "bs" ? "Ukupno" : "Total"}
            </Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>
              {money(data.totalAmount, data.currency, data.locale)}
            </Text>
          </View>
        </View>

        {data.notes ? (
          <View style={[styles.section, { marginTop: 24 }]}>
            <Text style={styles.bold}>
              {data.locale === "bs" ? "Napomena" : "Notes"}
            </Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  data: InvoicePdfData,
): Promise<Buffer> {
  ensurePdfFonts();
  const buffer = await renderToBuffer(<InvoiceDocument data={data} />);
  return Buffer.from(buffer);
}
