import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

type ReceiptLine = { code?: string; description?: string; amount?: number | string };
type ReceiptSnapshot = {
  submission_reference?: string;
  manuscript_title?: string;
  payment_reference?: string;
  provider?: string;
  received_from?: { name?: string; email?: string };
  line_items?: ReceiptLine[];
};

export type ReceiptPdfInput = {
  receiptNumber: string;
  amount: number;
  currency: string;
  issuedAt: string;
  snapshot: ReceiptSnapshot | null;
};

const styles = StyleSheet.create({
  page: { paddingTop: 54, paddingHorizontal: 52, paddingBottom: 48, fontSize: 10, color: "#172033", fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#d9deea", paddingBottom: 20 },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#172033" },
  eyebrow: { marginTop: 4, fontSize: 8, color: "#667085", letterSpacing: 0.7 },
  receiptLabel: { textAlign: "right", fontSize: 18, fontFamily: "Helvetica-Bold", color: "#172033" },
  number: { marginTop: 5, textAlign: "right", fontSize: 9, color: "#475467" },
  date: { marginTop: 3, textAlign: "right", fontSize: 8, color: "#667085" },
  details: { marginTop: 26, flexDirection: "row", gap: 24 },
  detailColumn: { flexGrow: 1, flexBasis: 0 },
  detailLabel: { fontSize: 8, color: "#667085", textTransform: "uppercase", letterSpacing: 0.55 },
  detailValue: { marginTop: 6, fontSize: 10, fontFamily: "Helvetica-Bold", color: "#172033" },
  detailText: { marginTop: 3, fontSize: 9, color: "#475467", lineHeight: 1.45 },
  reference: { marginTop: 24, borderRadius: 4, backgroundColor: "#f6f7fb", padding: 11 },
  referenceTitle: { fontSize: 8, color: "#667085", textTransform: "uppercase", letterSpacing: 0.55 },
  referenceText: { marginTop: 5, fontSize: 10, fontFamily: "Helvetica-Bold", color: "#172033" },
  table: { marginTop: 25, borderTopWidth: 1, borderTopColor: "#d9deea" },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#eaecf0", paddingVertical: 11 },
  tableHead: { paddingVertical: 8 },
  head: { fontSize: 8, color: "#667085", textTransform: "uppercase", letterSpacing: 0.55 },
  item: { flexGrow: 1, paddingRight: 12, fontSize: 10, color: "#172033" },
  amount: { width: 120, textAlign: "right", fontSize: 10, color: "#172033" },
  total: { marginTop: 18, alignSelf: "flex-end", width: 230, borderTopWidth: 1, borderTopColor: "#d9deea", paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalAmount: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  note: { marginTop: 36, borderRadius: 4, backgroundColor: "#eef8f2", padding: 12, color: "#1b6a42" },
  noteTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  noteText: { marginTop: 4, fontSize: 8.5, lineHeight: 1.45 },
  footer: { marginTop: 28, fontSize: 8, color: "#98a2b3", lineHeight: 1.45 }
});

function formatAmount(amount: number, currency: string) {
  return `${currency.toUpperCase()} ${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function formatDate(issuedAt: string) {
  return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(issuedAt));
}

function ReceiptPdf({ receiptNumber, amount, currency, issuedAt, snapshot }: ReceiptPdfInput) {
  const lines = Array.isArray(snapshot?.line_items) ? snapshot.line_items : [];
  const payer = snapshot?.received_from || {};
  return <Document title={`Official receipt ${receiptNumber}`} author="Talikha Publishing" subject="Payment receipt"><Page size="A4" style={styles.page}><View style={styles.header}><View><Text style={styles.brand}>Talikha Publishing</Text><Text style={styles.eyebrow}>Editorial and publication services</Text></View><View><Text style={styles.receiptLabel}>Official receipt</Text><Text style={styles.number}>{receiptNumber}</Text><Text style={styles.date}>{formatDate(issuedAt)}</Text></View></View><View style={styles.details}><View style={styles.detailColumn}><Text style={styles.detailLabel}>Received from</Text><Text style={styles.detailValue}>{payer.name || "Submitting author"}</Text>{payer.email ? <Text style={styles.detailText}>{payer.email}</Text> : null}</View><View style={styles.detailColumn}><Text style={styles.detailLabel}>Payment reference</Text><Text style={styles.detailValue}>{snapshot?.payment_reference || "Recorded by editorial office"}</Text><Text style={styles.detailText}>{snapshot?.provider || "Publication processing payment"}</Text></View></View><View style={styles.reference}><Text style={styles.referenceTitle}>Submission</Text><Text style={styles.referenceText}>{snapshot?.submission_reference || "Editorial submission"}</Text><Text style={styles.detailText}>{snapshot?.manuscript_title || "Publication processing"}</Text></View><View style={styles.table}><View style={[styles.row, styles.tableHead]}><Text style={styles.head}>Description</Text><Text style={[styles.head, styles.amount]}>Amount</Text></View>{lines.length ? lines.map((line, index) => <View style={styles.row} key={`${line.code || "item"}-${index}`}><Text style={styles.item}>{line.description || "Publication processing"}</Text><Text style={styles.amount}>{formatAmount(Number(line.amount || 0), currency)}</Text></View>) : <View style={styles.row}><Text style={styles.item}>Publication processing</Text><Text style={styles.amount}>{formatAmount(amount, currency)}</Text></View>}</View><View style={styles.total}><Text style={styles.totalLabel}>Total paid</Text><Text style={styles.totalAmount}>{formatAmount(amount, currency)}</Text></View><View style={styles.note}><Text style={styles.noteTitle}>Payment confirmed</Text><Text style={styles.noteText}>This receipt documents the confirmed payment and the fee breakdown recorded by Talikha Publishing.</Text></View><Text style={styles.footer}>This is a system-generated official receipt. Corrections are issued as a documented revision so the original payment record remains auditable.</Text></Page></Document>;
}

export async function renderOfficialReceiptPdf(input: ReceiptPdfInput) {
  return renderToBuffer(<ReceiptPdf {...input} />);
}
