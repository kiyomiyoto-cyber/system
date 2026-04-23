import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottom: '2 solid #2563eb', paddingBottom: 12 },
  companyBlock: { width: '50%' },
  companyName: { fontSize: 18, fontWeight: 'bold', color: '#2563eb', marginBottom: 4 },
  companyMeta: { fontSize: 9, color: '#4b5563', lineHeight: 1.5 },
  invoiceBlock: { width: '50%', alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  invoiceNumber: { fontSize: 11, color: '#4b5563', marginBottom: 2 },
  section: { marginBottom: 20 },
  label: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 3, letterSpacing: 0.5 },
  clientName: { fontSize: 12, fontWeight: 'bold', marginBottom: 3 },
  table: { borderTop: '1 solid #d1d5db', marginTop: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: 8, borderBottom: '1 solid #d1d5db' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottom: '1 solid #e5e7eb' },
  th: { fontSize: 8, fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' },
  td: { fontSize: 9 },
  colRef: { width: '15%' },
  colDesc: { width: '50%' },
  colQty: { width: '15%', textAlign: 'right' },
  colPrice: { width: '20%', textAlign: 'right' },
  totals: { marginTop: 20, marginLeft: 'auto', width: 250 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalsLabel: { fontSize: 10, color: '#4b5563' },
  totalsValue: { fontSize: 10, fontWeight: 'bold' },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginTop: 6, borderTop: '2 solid #2563eb' },
  grandTotalLabel: { fontSize: 12, fontWeight: 'bold' },
  grandTotalValue: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#9ca3af', textAlign: 'center', borderTop: '1 solid #e5e7eb', paddingTop: 10 },
  paymentBlock: { marginTop: 20, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4 },
})

interface InvoiceData {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  paymentTermsDays: number
  company: {
    name: string
    address: string | null
    city: string
    phone: string | null
    email: string | null
    ice: string | null
  }
  client: {
    business_name: string
    address: string | null
    city: string
    ice: string | null
  }
  shipments: Array<{
    reference: string
    pickup_city: string
    delivery_city: string
    distance_km: number
    price_excl_tax: number
  }>
  subtotal: number
  vatAmount: number
  totalAmount: number
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} MAD`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR')
}

export function InvoicePDF({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{data.company.name}</Text>
            <Text style={styles.companyMeta}>{data.company.address}</Text>
            <Text style={styles.companyMeta}>{data.company.city}</Text>
            {data.company.phone && <Text style={styles.companyMeta}>Tel: {data.company.phone}</Text>}
            {data.company.email && <Text style={styles.companyMeta}>{data.company.email}</Text>}
            {data.company.ice && <Text style={styles.companyMeta}>ICE: {data.company.ice}</Text>}
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceNumber}>N° {data.invoiceNumber}</Text>
            <Text style={styles.invoiceNumber}>Date: {formatDate(data.issueDate)}</Text>
            <Text style={styles.invoiceNumber}>Échéance: {formatDate(data.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Facturé à</Text>
          <Text style={styles.clientName}>{data.client.business_name}</Text>
          {data.client.address && <Text style={styles.companyMeta}>{data.client.address}</Text>}
          <Text style={styles.companyMeta}>{data.client.city}</Text>
          {data.client.ice && <Text style={styles.companyMeta}>ICE: {data.client.ice}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colRef]}>Référence</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Distance</Text>
            <Text style={[styles.th, styles.colPrice]}>Montant HT</Text>
          </View>
          {data.shipments.map((s) => (
            <View key={s.reference} style={styles.tableRow}>
              <Text style={[styles.td, styles.colRef]}>{s.reference}</Text>
              <Text style={[styles.td, styles.colDesc]}>{s.pickup_city} → {s.delivery_city}</Text>
              <Text style={[styles.td, styles.colQty]}>{s.distance_km.toFixed(1)} km</Text>
              <Text style={[styles.td, styles.colPrice]}>{formatCurrency(s.price_excl_tax)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sous-total HT</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>TVA (20%)</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.vatAmount)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(data.totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.paymentBlock}>
          <Text style={styles.label}>Conditions de paiement</Text>
          <Text style={styles.companyMeta}>Paiement par virement bancaire à {data.paymentTermsDays} jours.</Text>
        </View>

        <Text style={styles.footer}>
          {data.company.name} · {data.company.city} · {data.company.ice ? `ICE: ${data.company.ice}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
