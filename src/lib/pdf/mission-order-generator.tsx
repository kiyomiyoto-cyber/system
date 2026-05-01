import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottom: '2 solid #0f766e',
    paddingBottom: 12,
  },
  companyBlock: { width: '55%' },
  companyName: { fontSize: 16, fontWeight: 'bold', color: '#0f766e', marginBottom: 4 },
  companyMeta: { fontSize: 9, color: '#4b5563', lineHeight: 1.5 },
  docBlock: { width: '45%', alignItems: 'flex-end' },
  docTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  docNumber: { fontSize: 10, color: '#4b5563', marginBottom: 2 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    borderBottom: '1 solid #d1d5db',
    paddingBottom: 3,
  },
  twoCol: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  label: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 10, marginBottom: 6 },
  partnerName: { fontSize: 12, fontWeight: 'bold', marginBottom: 3 },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    marginBottom: 8,
  },
  routeArrow: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f766e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '1 solid #e5e7eb',
  },
  pricingLabel: { fontSize: 10, color: '#4b5563' },
  pricingValue: { fontSize: 10, fontWeight: 'bold' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 6,
    borderTop: '2 solid #0f766e',
  },
  totalLabel: { fontSize: 12, fontWeight: 'bold' },
  totalValue: { fontSize: 14, fontWeight: 'bold', color: '#0f766e' },
  signatureBlock: { flexDirection: 'row', marginTop: 30, gap: 20 },
  signatureBox: { flex: 1, paddingTop: 30, borderTop: '1 solid #9ca3af' },
  signatureLabel: { fontSize: 9, color: '#6b7280' },
  notes: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fef3c7',
    borderLeft: '3 solid #d97706',
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10,
  },
})

export interface MissionOrderData {
  missionOrderNumber: string
  issueDate: string
  company: {
    name: string
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    ice: string | null
  }
  subcontractor: {
    name: string
    contactName: string | null
    contactPhone: string | null
    contactEmail: string | null
    ice: string | null
    address: string | null
    city: string | null
  }
  shipment: {
    reference: string
    pickupStreet: string
    pickupCity: string
    pickupContactName: string | null
    pickupContactPhone: string | null
    pickupScheduledAt: string | null
    deliveryStreet: string
    deliveryCity: string
    deliveryContactName: string | null
    deliveryContactPhone: string | null
    deliveryScheduledAt: string | null
    weightKg: number | null
    description: string | null
    isUrgent: boolean
    distanceKm: number | null
  }
  pricing: {
    costExclTax: number
    currency: string
    paymentTermsDays: number
  }
  notes: string | null
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return `${dt.toLocaleDateString('fr-FR')} ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export function MissionOrderPDF({ data }: { data: MissionOrderData }) {
  const { company, subcontractor, shipment, pricing } = data
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address && <Text style={styles.companyMeta}>{company.address}</Text>}
            {company.city && <Text style={styles.companyMeta}>{company.city}</Text>}
            {company.phone && <Text style={styles.companyMeta}>Tel: {company.phone}</Text>}
            {company.email && <Text style={styles.companyMeta}>{company.email}</Text>}
            {company.ice && <Text style={styles.companyMeta}>ICE: {company.ice}</Text>}
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>ORDRE DE MISSION</Text>
            <Text style={styles.docNumber}>N° {data.missionOrderNumber}</Text>
            <Text style={styles.docNumber}>Date d&apos;émission : {formatDate(data.issueDate)}</Text>
            <Text style={styles.docNumber}>Réf. expédition : {shipment.reference}</Text>
            {shipment.isUrgent && (
              <Text style={[styles.docNumber, { color: '#b91c1c', fontWeight: 'bold' }]}>URGENT</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sous-traitant</Text>
          <Text style={styles.partnerName}>{subcontractor.name}</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              {subcontractor.contactName && (
                <>
                  <Text style={styles.label}>Contact</Text>
                  <Text style={styles.value}>{subcontractor.contactName}</Text>
                </>
              )}
              {subcontractor.contactPhone && (
                <>
                  <Text style={styles.label}>Téléphone</Text>
                  <Text style={styles.value}>{subcontractor.contactPhone}</Text>
                </>
              )}
            </View>
            <View style={styles.col}>
              {subcontractor.address && (
                <>
                  <Text style={styles.label}>Adresse</Text>
                  <Text style={styles.value}>
                    {subcontractor.address}
                    {subcontractor.city ? `, ${subcontractor.city}` : ''}
                  </Text>
                </>
              )}
              {subcontractor.ice && (
                <>
                  <Text style={styles.label}>ICE</Text>
                  <Text style={styles.value}>{subcontractor.ice}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mission</Text>
          <View style={styles.routeBox}>
            <View style={styles.col}>
              <Text style={styles.label}>Chargement</Text>
              <Text style={styles.value}>
                {shipment.pickupStreet}
                {'\n'}
                {shipment.pickupCity}
              </Text>
              <Text style={styles.label}>Date prévue</Text>
              <Text style={styles.value}>{formatDateTime(shipment.pickupScheduledAt)}</Text>
              {shipment.pickupContactName && (
                <>
                  <Text style={styles.label}>Contact</Text>
                  <Text style={styles.value}>
                    {shipment.pickupContactName}
                    {shipment.pickupContactPhone ? ` · ${shipment.pickupContactPhone}` : ''}
                  </Text>
                </>
              )}
            </View>
            <Text style={styles.routeArrow}>→</Text>
            <View style={styles.col}>
              <Text style={styles.label}>Livraison</Text>
              <Text style={styles.value}>
                {shipment.deliveryStreet}
                {'\n'}
                {shipment.deliveryCity}
              </Text>
              <Text style={styles.label}>Date prévue</Text>
              <Text style={styles.value}>{formatDateTime(shipment.deliveryScheduledAt)}</Text>
              {shipment.deliveryContactName && (
                <>
                  <Text style={styles.label}>Contact</Text>
                  <Text style={styles.value}>
                    {shipment.deliveryContactName}
                    {shipment.deliveryContactPhone ? ` · ${shipment.deliveryContactPhone}` : ''}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>Marchandise</Text>
              <Text style={styles.value}>{shipment.description || '—'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Poids</Text>
              <Text style={styles.value}>
                {shipment.weightKg ? `${shipment.weightKg} kg` : '—'}
              </Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.value}>
                {shipment.distanceKm ? `${shipment.distanceKm.toFixed(1)} km` : '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarif convenu</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Prix forfaitaire HT (mission complète)</Text>
            <Text style={styles.pricingValue}>
              {formatCurrency(pricing.costExclTax, pricing.currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(pricing.costExclTax, pricing.currency)}
            </Text>
          </View>
          <Text style={[styles.companyMeta, { marginTop: 8 }]}>
            Paiement par virement bancaire à {pricing.paymentTermsDays} jours sur présentation de
            facture conforme accompagnée du bon de livraison signé.
          </Text>
        </View>

        {data.notes && (
          <View style={styles.notes}>
            <Text>{data.notes}</Text>
          </View>
        )}

        <View style={styles.signatureBlock}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Pour {company.name} (Donneur d&apos;ordre)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Pour {subcontractor.name} (Bon pour accord)</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {company.name}
          {company.city ? ` · ${company.city}` : ''}
          {company.ice ? ` · ICE: ${company.ice}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
