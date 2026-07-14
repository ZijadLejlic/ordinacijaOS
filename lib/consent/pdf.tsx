import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToBuffer,
} from "@react-pdf/renderer";

export type ConsentPdfData = {
  clinicName: string;
  patientName: string;
  title: string;
  bodyText: string;
  signaturePngDataUrl: string;
  signedAt: string;
  locale: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.45,
  },
  clinic: { fontSize: 10, color: "#555555", marginBottom: 16 },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
  },
  body: { marginBottom: 24 },
  paragraph: { marginBottom: 10 },
  meta: { fontSize: 10, color: "#555555", marginBottom: 8 },
  signatureLabel: {
    fontSize: 10,
    color: "#555555",
    marginBottom: 6,
  },
  signature: {
    width: 220,
    height: 80,
    objectFit: "contain",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
});

function ConsentDocument({ data }: { data: ConsentPdfData }) {
  const paragraphs = data.bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const signedLabel =
    data.locale === "en" ? "Signed at" : "Potpisano";
  const signatureLabel =
    data.locale === "en" ? "Patient signature" : "Potpis pacijenta";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.clinic}>{data.clinicName}</Text>
        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.body}>
          {paragraphs.map((block, i) => (
            <Text key={i} style={styles.paragraph}>
              {block}
            </Text>
          ))}
        </View>
        <Text style={styles.meta}>
          {signedLabel}: {data.signedAt} — {data.patientName}
        </Text>
        <Text style={styles.signatureLabel}>{signatureLabel}</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image */}
        <Image src={data.signaturePngDataUrl} style={styles.signature} />
      </Page>
    </Document>
  );
}

export async function renderConsentPdf(
  data: ConsentPdfData,
): Promise<Buffer> {
  const buffer = await renderToBuffer(<ConsentDocument data={data} />);
  return Buffer.from(buffer);
}
