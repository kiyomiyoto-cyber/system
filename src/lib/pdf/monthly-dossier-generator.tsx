import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AccountingDocumentCategory } from '@/types/database.types'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#1f2937' },
  cover: { padding: 60, fontFamily: 'Helvetica', color: '#1f2937' },
  coverBrand: { fontSize: 28, fontWeight: 'bold', color: '#2563eb', marginBottom: 4 },
  coverTagline: { fontSize: 11, color: '#6b7280', marginBottom: 60 },
  coverTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  coverPeriod: { fontSize: 36, fontWeight: 'bold', color: '#2563eb', marginBottom: 40 },
  coverSummary: { borderTop: '1 solid #d1d5db', paddingTop: 14, gap: 6 },
  coverRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  coverLabel: { fontSize: 11, color: '#4b5563' },
  coverValue: { fontSize: 11, fontWeight: 'bold' },
  coverHighlight: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginTop: 10, backgroundColor: '#eef2ff', borderRadius: 4, paddingHorizontal: 10 },
  coverHighlightLabel: { fontSize: 12, fontWeight: 'bold', color: '#1e40af' },
  coverHighlightValue: { fontSize: 14, fontWeight: 'bold', color: '#1e40af' },
  coverGenInfo: { position: 'absolute', bottom: 36, left: 60, right: 60, fontSize: 9, color: '#9ca3af', borderTop: '1 solid #e5e7eb', paddingTop: 8 },
  signatureBox: { marginTop: 50, flexDirection: 'row', justifyContent: 'space-between', gap: 30 },
  signatureCell: { flex: 1, borderTop: '1 solid #9ca3af', paddingTop: 4, fontSize: 8, color: '#6b7280' },

  h1: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#111827' },
  h2: { fontSize: 11, fontWeight: 'bold', marginTop: 18, marginBottom: 6, color: '#1f2937', borderBottom: '1 solid #e5e7eb', paddingBottom: 3 },
  meta: { fontSize: 8, color: '#6b7280', marginBottom: 12 },

  table: { borderTop: '1 solid #d1d5db', marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6, borderBottom: '1 solid #d1d5db' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottom: '1 solid #f3f4f6' },
  tableFooter: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderTop: '1.5 solid #1f2937', fontWeight: 'bold', backgroundColor: '#f9fafb' },
  th: { fontSize: 8, fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' },
  td: { fontSize: 8 },
  right: { textAlign: 'right' },

  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, fontSize: 7, color: '#9ca3af', textAlign: 'center', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
})

const CATEGORY_LABEL: Record<AccountingDocumentCategory, string> = {
  invoice_client: 'Facture client',
  invoice_supplier: 'Facture fournisseur',
  fuel_receipt: 'Carburant',
  toll_receipt: 'Péage',
  maintenance_receipt: 'Maintenance',
  driver_advance: 'Avance chauffeur',
  salary_slip: 'Bulletin de paie',
  cnss_payment: 'Paiement CNSS',
  ir_payment: 'Paiement IR',
  phone_internet: 'Téléphone / Internet',
  office_rent: 'Loyer bureau',
  insurance: 'Assurance',
  bank_statement: 'Relevé bancaire',
  bank_fee: 'Frais bancaires',
  other: 'Autre',
}

function fmt(amount: number): string {
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR')
}

export interface DossierExpenseRow {
  category: AccountingDocumentCategory
  count: number
  totalTtc: number
  vatTotal: number
}

export interface DossierExpenseDetail {
  date: string | null
  supplier: string | null
  category: AccountingDocumentCategory
  ttc: number
  vat: number | null
}

export interface DossierInvoiceRow {
  reference: string
  client: string
  issuedAt: string | null
  ht: number
  tax: number
  ttc: number
  status: string | null
}

export interface DossierPayrollRow {
  driverName: string
  gross: number
  cnssEmployee: number
  amoEmployee: number
  ir: number
  net: number
}

export interface DossierData {
  companyName: string
  companyIce: string | null
  companyCity: string | null
  companyAddress: string | null
  periodLabel: string
  generatedAt: string
  totals: {
    revenueExclTax: number
    revenueInclTax: number
    expenses: number
    vatCollected: number
    vatDeductible: number
    vatToPay: number
    payrollGross: number
    payrollNet: number
    employerCost: number
    documentsCount: number
  }
  invoices: DossierInvoiceRow[]
  expensesByCategory: DossierExpenseRow[]
  expensesDetail: DossierExpenseDetail[]
  payroll: DossierPayrollRow[]
}

export function MonthlyDossierPDF({ data }: { data: DossierData }) {
  const margin = data.totals.revenueExclTax - data.totals.expenses

  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.cover}>
        <Text style={styles.coverBrand}>{data.companyName}</Text>
        <Text style={styles.coverTagline}>Dossier comptable mensuel — généré automatiquement</Text>

        <Text style={styles.coverTitle}>Période</Text>
        <Text style={styles.coverPeriod}>{data.periodLabel}</Text>

        <View style={styles.coverSummary}>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Chiffre d'affaires HT</Text>
            <Text style={styles.coverValue}>{fmt(data.totals.revenueExclTax)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Total charges TTC</Text>
            <Text style={styles.coverValue}>{fmt(data.totals.expenses)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Marge brute estimée</Text>
            <Text style={styles.coverValue}>{fmt(margin)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>TVA collectée</Text>
            <Text style={styles.coverValue}>{fmt(data.totals.vatCollected)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>TVA déductible</Text>
            <Text style={styles.coverValue}>{fmt(data.totals.vatDeductible)}</Text>
          </View>
          <View style={styles.coverHighlight}>
            <Text style={styles.coverHighlightLabel}>TVA à payer</Text>
            <Text style={styles.coverHighlightValue}>{fmt(data.totals.vatToPay)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Masse salariale brute</Text>
            <Text style={styles.coverValue}>{fmt(data.totals.payrollGross)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Coût employeur total</Text>
            <Text style={styles.coverValue}>{fmt(data.totals.employerCost)}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Justificatifs joints</Text>
            <Text style={styles.coverValue}>{data.totals.documentsCount}</Text>
          </View>
        </View>

        <View style={styles.signatureBox}>
          <View style={styles.signatureCell}>
            <Text>Signature & cachet du gérant</Text>
          </View>
          <View style={styles.signatureCell}>
            <Text>Signature & cachet du comptable</Text>
          </View>
        </View>

        <Text style={styles.coverGenInfo}>
          {data.companyName}
          {data.companyIce ? ` · ICE: ${data.companyIce}` : ''}
          {data.companyCity ? ` · ${data.companyCity}` : ''}
          {' · Document généré le '}{fmtDate(data.generatedAt)}
        </Text>
      </Page>

      {/* Invoices */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Factures clients émises</Text>
        <Text style={styles.meta}>Période : {data.periodLabel} · {data.invoices.length} factures</Text>

        {data.invoices.length === 0 ? (
          <Text style={styles.td}>Aucune facture émise sur la période.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '18%' }]}>Numéro</Text>
              <Text style={[styles.th, { width: '12%' }]}>Date</Text>
              <Text style={[styles.th, { width: '30%' }]}>Client</Text>
              <Text style={[styles.th, styles.right, { width: '13%' }]}>HT</Text>
              <Text style={[styles.th, styles.right, { width: '13%' }]}>TVA</Text>
              <Text style={[styles.th, styles.right, { width: '14%' }]}>TTC</Text>
            </View>
            {data.invoices.map((inv) => (
              <View key={inv.reference} style={styles.tableRow}>
                <Text style={[styles.td, { width: '18%' }]}>{inv.reference}</Text>
                <Text style={[styles.td, { width: '12%' }]}>{fmtDate(inv.issuedAt)}</Text>
                <Text style={[styles.td, { width: '30%' }]}>{inv.client}</Text>
                <Text style={[styles.td, styles.right, { width: '13%' }]}>{fmt(inv.ht)}</Text>
                <Text style={[styles.td, styles.right, { width: '13%' }]}>{fmt(inv.tax)}</Text>
                <Text style={[styles.td, styles.right, { width: '14%' }]}>{fmt(inv.ttc)}</Text>
              </View>
            ))}
            <View style={styles.tableFooter}>
              <Text style={[styles.td, { width: '60%' }]}>Total CA</Text>
              <Text style={[styles.td, styles.right, { width: '13%' }]}>{fmt(data.totals.revenueExclTax)}</Text>
              <Text style={[styles.td, styles.right, { width: '13%' }]}>{fmt(data.totals.vatCollected)}</Text>
              <Text style={[styles.td, styles.right, { width: '14%' }]}>{fmt(data.totals.revenueInclTax)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>{data.companyName} · {data.periodLabel}</Text>
      </Page>

      {/* Expenses summary + detail */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Charges du mois</Text>
        <Text style={styles.meta}>Récapitulatif par catégorie + détail des justificatifs</Text>

        <Text style={styles.h2}>Synthèse par catégorie</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '50%' }]}>Catégorie</Text>
            <Text style={[styles.th, styles.right, { width: '15%' }]}>Pièces</Text>
            <Text style={[styles.th, styles.right, { width: '17%' }]}>TTC</Text>
            <Text style={[styles.th, styles.right, { width: '18%' }]}>TVA récup.</Text>
          </View>
          {data.expensesByCategory.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { width: '100%' }]}>Aucune charge enregistrée.</Text>
            </View>
          ) : data.expensesByCategory.map((row) => (
            <View key={row.category} style={styles.tableRow}>
              <Text style={[styles.td, { width: '50%' }]}>{CATEGORY_LABEL[row.category]}</Text>
              <Text style={[styles.td, styles.right, { width: '15%' }]}>{row.count}</Text>
              <Text style={[styles.td, styles.right, { width: '17%' }]}>{fmt(row.totalTtc)}</Text>
              <Text style={[styles.td, styles.right, { width: '18%' }]}>{fmt(row.vatTotal)}</Text>
            </View>
          ))}
          <View style={styles.tableFooter}>
            <Text style={[styles.td, { width: '65%' }]}>Total charges</Text>
            <Text style={[styles.td, styles.right, { width: '17%' }]}>{fmt(data.totals.expenses)}</Text>
            <Text style={[styles.td, styles.right, { width: '18%' }]}>{fmt(data.totals.vatDeductible)}</Text>
          </View>
        </View>

        <Text style={styles.h2}>Détail des justificatifs</Text>
        {data.expensesDetail.length === 0 ? (
          <Text style={styles.td}>—</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '14%' }]}>Date</Text>
              <Text style={[styles.th, { width: '40%' }]}>Fournisseur</Text>
              <Text style={[styles.th, { width: '24%' }]}>Catégorie</Text>
              <Text style={[styles.th, styles.right, { width: '11%' }]}>TVA</Text>
              <Text style={[styles.th, styles.right, { width: '11%' }]}>TTC</Text>
            </View>
            {data.expensesDetail.map((row, idx) => (
              <View key={`${row.date}-${idx}`} style={styles.tableRow}>
                <Text style={[styles.td, { width: '14%' }]}>{fmtDate(row.date)}</Text>
                <Text style={[styles.td, { width: '40%' }]}>{row.supplier ?? '—'}</Text>
                <Text style={[styles.td, { width: '24%' }]}>{CATEGORY_LABEL[row.category]}</Text>
                <Text style={[styles.td, styles.right, { width: '11%' }]}>{row.vat == null ? '—' : fmt(row.vat)}</Text>
                <Text style={[styles.td, styles.right, { width: '11%' }]}>{fmt(row.ttc)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>{data.companyName} · {data.periodLabel}</Text>
      </Page>

      {/* Payroll */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Paie chauffeurs</Text>
        <Text style={styles.meta}>Détail mensuel + cotisations CNSS / AMO / IR</Text>

        {data.payroll.length === 0 ? (
          <Text style={styles.td}>Aucune fiche de paie validée pour ce mois.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '30%' }]}>Chauffeur</Text>
              <Text style={[styles.th, styles.right, { width: '17%' }]}>Brut</Text>
              <Text style={[styles.th, styles.right, { width: '13%' }]}>CNSS sal.</Text>
              <Text style={[styles.th, styles.right, { width: '13%' }]}>AMO sal.</Text>
              <Text style={[styles.th, styles.right, { width: '12%' }]}>IR</Text>
              <Text style={[styles.th, styles.right, { width: '15%' }]}>Net</Text>
            </View>
            {data.payroll.map((row) => (
              <View key={row.driverName} style={styles.tableRow}>
                <Text style={[styles.td, { width: '30%' }]}>{row.driverName}</Text>
                <Text style={[styles.td, styles.right, { width: '17%' }]}>{fmt(row.gross)}</Text>
                <Text style={[styles.td, styles.right, { width: '13%' }]}>{fmt(row.cnssEmployee)}</Text>
                <Text style={[styles.td, styles.right, { width: '13%' }]}>{fmt(row.amoEmployee)}</Text>
                <Text style={[styles.td, styles.right, { width: '12%' }]}>{fmt(row.ir)}</Text>
                <Text style={[styles.td, styles.right, { width: '15%' }]}>{fmt(row.net)}</Text>
              </View>
            ))}
            <View style={styles.tableFooter}>
              <Text style={[styles.td, { width: '30%' }]}>Total</Text>
              <Text style={[styles.td, styles.right, { width: '17%' }]}>{fmt(data.totals.payrollGross)}</Text>
              <Text style={[styles.td, styles.right, { width: '13%' }]} />
              <Text style={[styles.td, styles.right, { width: '13%' }]} />
              <Text style={[styles.td, styles.right, { width: '12%' }]} />
              <Text style={[styles.td, styles.right, { width: '15%' }]}>{fmt(data.totals.payrollNet)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>{data.companyName} · {data.periodLabel} · Coût employeur total : {fmt(data.totals.employerCost)}</Text>
      </Page>
    </Document>
  )
}
