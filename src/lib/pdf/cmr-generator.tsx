import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * Lettre de voiture CMR — official 24-box international transport
 * contract layout (Convention de Genève 1956). The proportions follow
 * the standard form so a customs officer or driver can find every
 * piece of information at the expected position.
 *
 * The form is a single A4 page broken into a 4-column grid of boxes,
 * each box numbered (1..24) with its title in French + Arabic header.
 */

const styles = StyleSheet.create({
  page: { padding: 16, fontSize: 7.5, fontFamily: 'Helvetica', color: '#0b1220' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1.5 solid #0b1220',
    paddingBottom: 4,
    marginBottom: 4,
  },
  headerLeft: { flexDirection: 'column' },
  title: { fontSize: 13, fontWeight: 'bold' },
  subtitle: { fontSize: 7, color: '#374151' },
  headerRight: { alignItems: 'flex-end' },
  cmrNumber: { fontSize: 10, fontWeight: 'bold', color: '#0b1220' },
  cmrLabel: { fontSize: 7, color: '#374151', marginTop: 2 },

  row: { flexDirection: 'row' },
  fullBox: {
    border: '0.6 solid #0b1220',
    padding: 4,
    minHeight: 38,
    borderTop: 0,
    flex: 1,
  },
  half: { flex: 1 },
  third: { flex: 1 },
  boxTitle: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  boxNumber: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#0b1220',
    marginEnd: 3,
  },
  boxValue: { fontSize: 8.5, color: '#0b1220', marginTop: 2 },
  smallLabel: { fontSize: 6.5, color: '#6b7280', marginBottom: 1 },

  goodsTable: {
    border: '0.6 solid #0b1220',
    borderTop: 0,
    flex: 1,
  },
  goodsHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottom: '0.6 solid #0b1220',
  },
  goodsHeaderCell: {
    padding: 3,
    borderEnd: '0.4 solid #0b1220',
    fontSize: 6,
    fontWeight: 'bold',
    color: '#0b1220',
    textAlign: 'center',
  },
  goodsRow: { flexDirection: 'row', minHeight: 28 },
  goodsCell: {
    padding: 4,
    borderEnd: '0.4 solid #0b1220',
    fontSize: 8,
    color: '#0b1220',
  },
  col6: { width: '14%' },
  col7: { width: '11%' },
  col8: { width: '14%' },
  col9: { width: '34%' },
  col10: { width: '12%' },
  col11: { width: '12%' },
  col12: { width: '13%' },

  charges: {
    flexDirection: 'row',
    border: '0.6 solid #0b1220',
    borderTop: 0,
    flex: 1,
  },
  chargesCol: {
    flex: 1,
    padding: 4,
    borderEnd: '0.4 solid #0b1220',
  },
  chargesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  chargesLabel: { fontSize: 7, color: '#374151' },
  chargesValue: { fontSize: 8, fontWeight: 'bold' },

  signatureBlock: {
    flexDirection: 'row',
    border: '0.6 solid #0b1220',
    borderTop: 0,
  },
  signatureBox: {
    flex: 1,
    padding: 4,
    borderEnd: '0.4 solid #0b1220',
    minHeight: 56,
  },
  signatureLine: {
    borderBottom: '0.4 dotted #6b7280',
    marginTop: 18,
    marginBottom: 4,
  },

  footer: {
    marginTop: 6,
    fontSize: 6,
    color: '#6b7280',
    textAlign: 'center',
  },
})

export interface CmrPdfData {
  cmrNumber: string
  status: 'draft' | 'issued' | 'signed' | 'cancelled'

  // Box 1
  sender: {
    name: string
    address: string
    city: string
    country: string
    ice: string | null
  }
  // Box 2
  consignee: {
    name: string
    address: string
    city: string
    country: string
    ice: string | null
  }
  // Box 3
  deliveryPlace: string
  deliveryCountry: string
  // Box 4
  takingOverPlace: string
  takingOverCountry: string
  takingOverDate: string | null
  // Box 5
  attachedDocuments: string | null
  // Boxes 6-12
  goods: {
    marksAndNumbers: string | null
    packagesCount: number | null
    packingMethod: string | null
    natureOfGoods: string
    statisticalNumber: string | null
    grossWeightKg: number | null
    volumeM3: number | null
  }
  // Box 13
  senderInstructions: string | null
  // Box 14
  carrier: {
    name: string
    address: string | null
    country: string
    ice: string | null
    vehiclePlate: string | null
    trailerPlate: string | null
    driverName: string | null
  }
  // Box 15
  successiveCarriers: string | null
  // Box 16
  carrierObservations: string | null
  // Box 18 (charges)
  charges: {
    freight: number | null
    supplementary: number | null
    customs: number | null
    other: number | null
    total: number | null
    payer: 'sender' | 'consignee' | 'split'
  }
  // Box 19
  cashOnDelivery: number | null
  // Box 20
  issuedPlace: string
  issuedDate: string
  // Box 21
  specialAgreements: string | null
  // Boxes 22-24 signatures
  signatures: {
    sender: { place: string | null; date: string | null }
    carrier: { place: string | null; date: string | null }
    consignee: { place: string | null; date: string | null }
  }
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR')
}

function formatCurrency(amount: number | null): string {
  if (amount == null || amount === 0) return ''
  return `${amount.toFixed(2)} MAD`
}

function payerLabel(p: 'sender' | 'consignee' | 'split'): string {
  if (p === 'sender') return 'Expéditeur'
  if (p === 'consignee') return 'Destinataire'
  return 'Partagé'
}

function partyBlock(party: {
  name: string
  address: string
  city: string
  country: string
  ice: string | null
}): React.ReactNode {
  return (
    <>
      <Text style={styles.boxValue}>{party.name}</Text>
      <Text style={[styles.boxValue, { fontSize: 7.5 }]}>{party.address}</Text>
      <Text style={[styles.boxValue, { fontSize: 7.5 }]}>
        {party.city}
        {party.country ? `, ${party.country}` : ''}
      </Text>
      {party.ice && (
        <Text style={[styles.boxValue, { fontSize: 7, color: '#374151' }]}>
          ICE: {party.ice}
        </Text>
      )}
    </>
  )
}

export function CmrPDF({ data }: { data: CmrPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>LETTRE DE VOITURE INTERNATIONALE</Text>
            <Text style={styles.subtitle}>
              Convention CMR — Genève, 19 mai 1956
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.cmrNumber}>N° {data.cmrNumber}</Text>
            <Text style={styles.cmrLabel}>
              {data.status === 'draft'
                ? 'BROUILLON — non valide pour la circulation'
                : data.status === 'issued'
                  ? 'ÉMISE'
                  : data.status === 'signed'
                    ? 'SIGNÉE'
                    : 'ANNULÉE'}
            </Text>
          </View>
        </View>

        {/* Boxes 1 + 2 — Sender / Consignee */}
        <View style={styles.row}>
          <View style={[styles.fullBox, styles.half, { borderTop: '0.6 solid #0b1220' }]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>1</Text>
              <Text style={styles.boxTitle}>Expéditeur (nom, adresse, pays)</Text>
            </View>
            {partyBlock(data.sender)}
          </View>
          <View style={[styles.fullBox, styles.half, { borderTop: '0.6 solid #0b1220' }]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>2</Text>
              <Text style={styles.boxTitle}>Destinataire (nom, adresse, pays)</Text>
            </View>
            {partyBlock(data.consignee)}
          </View>
        </View>

        {/* Boxes 3 + 4 — Delivery / Taking over */}
        <View style={styles.row}>
          <View style={[styles.fullBox, styles.half]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>3</Text>
              <Text style={styles.boxTitle}>Lieu prévu pour la livraison</Text>
            </View>
            <Text style={styles.boxValue}>
              {data.deliveryPlace}
              {data.deliveryCountry ? `, ${data.deliveryCountry}` : ''}
            </Text>
          </View>
          <View style={[styles.fullBox, styles.half]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>4</Text>
              <Text style={styles.boxTitle}>Lieu et date de prise en charge de la marchandise</Text>
            </View>
            <Text style={styles.boxValue}>
              {data.takingOverPlace}
              {data.takingOverCountry ? `, ${data.takingOverCountry}` : ''}
            </Text>
            <Text style={[styles.boxValue, { fontSize: 7.5, color: '#374151' }]}>
              {formatDate(data.takingOverDate)}
            </Text>
          </View>
        </View>

        {/* Box 5 — Attached documents */}
        <View style={styles.row}>
          <View style={styles.fullBox}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>5</Text>
              <Text style={styles.boxTitle}>Documents annexés</Text>
            </View>
            <Text style={styles.boxValue}>{data.attachedDocuments || '—'}</Text>
          </View>
        </View>

        {/* Boxes 6-12 — Goods table */}
        <View style={styles.row}>
          <View style={styles.goodsTable}>
            <View style={styles.goodsHeader}>
              <Text style={[styles.goodsHeaderCell, styles.col6]}>6 · Marques et n°</Text>
              <Text style={[styles.goodsHeaderCell, styles.col7]}>7 · N° colis</Text>
              <Text style={[styles.goodsHeaderCell, styles.col8]}>8 · Emballage</Text>
              <Text style={[styles.goodsHeaderCell, styles.col9]}>9 · Nature de la marchandise</Text>
              <Text style={[styles.goodsHeaderCell, styles.col10]}>10 · N° statistique</Text>
              <Text style={[styles.goodsHeaderCell, styles.col11]}>11 · Poids brut (kg)</Text>
              <Text style={[styles.goodsHeaderCell, styles.col12, { borderRightWidth: 0 }]}>
                12 · Cubage (m³)
              </Text>
            </View>
            <View style={styles.goodsRow}>
              <Text style={[styles.goodsCell, styles.col6]}>{data.goods.marksAndNumbers ?? ''}</Text>
              <Text style={[styles.goodsCell, styles.col7, { textAlign: 'right' }]}>
                {data.goods.packagesCount ?? ''}
              </Text>
              <Text style={[styles.goodsCell, styles.col8]}>{data.goods.packingMethod ?? ''}</Text>
              <Text style={[styles.goodsCell, styles.col9]}>{data.goods.natureOfGoods}</Text>
              <Text style={[styles.goodsCell, styles.col10]}>
                {data.goods.statisticalNumber ?? ''}
              </Text>
              <Text style={[styles.goodsCell, styles.col11, { textAlign: 'right' }]}>
                {data.goods.grossWeightKg != null
                  ? data.goods.grossWeightKg.toFixed(2)
                  : ''}
              </Text>
              <Text
                style={[
                  styles.goodsCell,
                  styles.col12,
                  { textAlign: 'right', borderRightWidth: 0 },
                ]}
              >
                {data.goods.volumeM3 != null ? data.goods.volumeM3.toFixed(3) : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Box 13 + 14 — Sender's instructions / Carrier */}
        <View style={styles.row}>
          <View style={[styles.fullBox, styles.half]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>13</Text>
              <Text style={styles.boxTitle}>Instructions de l&apos;expéditeur</Text>
            </View>
            <Text style={styles.boxValue}>{data.senderInstructions || '—'}</Text>
          </View>
          <View style={[styles.fullBox, styles.half]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>14</Text>
              <Text style={styles.boxTitle}>Transporteur (nom, adresse, pays)</Text>
            </View>
            <Text style={styles.boxValue}>{data.carrier.name}</Text>
            {data.carrier.address && (
              <Text style={[styles.boxValue, { fontSize: 7.5 }]}>
                {data.carrier.address}
                {data.carrier.country ? `, ${data.carrier.country}` : ''}
              </Text>
            )}
            {data.carrier.ice && (
              <Text style={[styles.boxValue, { fontSize: 7, color: '#374151' }]}>
                ICE: {data.carrier.ice}
              </Text>
            )}
            {(data.carrier.vehiclePlate || data.carrier.trailerPlate) && (
              <Text style={[styles.boxValue, { fontSize: 7.5, marginTop: 4 }]}>
                Tracteur: {data.carrier.vehiclePlate ?? '—'}
                {data.carrier.trailerPlate ? ` · Remorque: ${data.carrier.trailerPlate}` : ''}
              </Text>
            )}
            {data.carrier.driverName && (
              <Text style={[styles.boxValue, { fontSize: 7.5 }]}>
                Chauffeur: {data.carrier.driverName}
              </Text>
            )}
          </View>
        </View>

        {/* Box 15 + 16 */}
        <View style={styles.row}>
          <View style={[styles.fullBox, styles.half]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>15</Text>
              <Text style={styles.boxTitle}>Transporteurs successifs</Text>
            </View>
            <Text style={styles.boxValue}>{data.successiveCarriers || '—'}</Text>
          </View>
          <View style={[styles.fullBox, styles.half]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>16</Text>
              <Text style={styles.boxTitle}>Réserves et observations du transporteur</Text>
            </View>
            <Text style={styles.boxValue}>{data.carrierObservations || '—'}</Text>
          </View>
        </View>

        {/* Box 18 (charges) */}
        <View style={styles.row}>
          <View
            style={[
              styles.fullBox,
              { borderBottom: '0.6 solid #0b1220', paddingBottom: 0 },
            ]}
          >
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>18</Text>
              <Text style={styles.boxTitle}>Prescriptions d&apos;affranchissement</Text>
            </View>
            <View style={{ marginTop: 2 }}>
              <View style={styles.chargesRow}>
                <Text style={styles.chargesLabel}>Frais de transport</Text>
                <Text style={styles.chargesValue}>
                  {formatCurrency(data.charges.freight) || '—'}
                </Text>
              </View>
              <View style={styles.chargesRow}>
                <Text style={styles.chargesLabel}>Frais accessoires</Text>
                <Text style={styles.chargesValue}>
                  {formatCurrency(data.charges.supplementary) || '—'}
                </Text>
              </View>
              <View style={styles.chargesRow}>
                <Text style={styles.chargesLabel}>Droits de douane</Text>
                <Text style={styles.chargesValue}>
                  {formatCurrency(data.charges.customs) || '—'}
                </Text>
              </View>
              <View style={styles.chargesRow}>
                <Text style={styles.chargesLabel}>Autres frais</Text>
                <Text style={styles.chargesValue}>
                  {formatCurrency(data.charges.other) || '—'}
                </Text>
              </View>
              <View
                style={[
                  styles.chargesRow,
                  { borderTop: '0.4 solid #0b1220', marginTop: 2, paddingTop: 2 },
                ]}
              >
                <Text style={[styles.chargesLabel, { fontWeight: 'bold' }]}>
                  Total — à payer par {payerLabel(data.charges.payer)}
                </Text>
                <Text style={[styles.chargesValue, { fontSize: 9 }]}>
                  {formatCurrency(data.charges.total) || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Box 19 + 20 + 21 */}
        <View style={styles.row}>
          <View style={[styles.fullBox, styles.third]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>19</Text>
              <Text style={styles.boxTitle}>Remboursement</Text>
            </View>
            <Text style={styles.boxValue}>
              {formatCurrency(data.cashOnDelivery) || '—'}
            </Text>
          </View>
          <View style={[styles.fullBox, styles.third]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>20</Text>
              <Text style={styles.boxTitle}>Établi à / le</Text>
            </View>
            <Text style={styles.boxValue}>{data.issuedPlace}</Text>
            <Text style={[styles.boxValue, { fontSize: 7.5 }]}>
              {formatDate(data.issuedDate)}
            </Text>
          </View>
          <View style={[styles.fullBox, styles.third]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>21</Text>
              <Text style={styles.boxTitle}>Conventions particulières</Text>
            </View>
            <Text style={styles.boxValue}>{data.specialAgreements || '—'}</Text>
          </View>
        </View>

        {/* Boxes 22-24 — signatures */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureBox}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>22</Text>
              <Text style={styles.boxTitle}>Signature et timbre de l&apos;expéditeur</Text>
            </View>
            <View style={styles.signatureLine} />
            <Text style={styles.smallLabel}>
              Lieu : {data.signatures.sender.place ?? ''}
            </Text>
            <Text style={styles.smallLabel}>
              Date : {formatDate(data.signatures.sender.date)}
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>23</Text>
              <Text style={styles.boxTitle}>Signature et timbre du transporteur</Text>
            </View>
            <View style={styles.signatureLine} />
            <Text style={styles.smallLabel}>
              Lieu : {data.signatures.carrier.place ?? ''}
            </Text>
            <Text style={styles.smallLabel}>
              Date : {formatDate(data.signatures.carrier.date)}
            </Text>
          </View>
          <View style={[styles.signatureBox, { borderRightWidth: 0 }]}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.boxNumber}>24</Text>
              <Text style={styles.boxTitle}>Marchandise reçue — destinataire</Text>
            </View>
            <View style={styles.signatureLine} />
            <Text style={styles.smallLabel}>
              Lieu : {data.signatures.consignee.place ?? ''}
            </Text>
            <Text style={styles.smallLabel}>
              Date : {formatDate(data.signatures.consignee.date)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Lettre de voiture CMR · Document généré électroniquement par MASLAK ·
          {' '}
          {data.cmrNumber}
        </Text>
      </Page>
    </Document>
  )
}
