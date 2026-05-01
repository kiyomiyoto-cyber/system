import 'server-only'
import ExcelJS from 'exceljs'

/**
 * Branded MASLAK header bar applied to the top of every worksheet so that
 * exports stay visually consistent across modules (shipments, invoices,
 * JIT, monthly dossier).
 */
const BRAND_BLUE = 'FF1E40AF' // primary
const BRAND_LIGHT = 'FFEFF6FF'
const BRAND_BORDER = 'FFE5E7EB'

export interface SheetMeta {
  /** Page title, displayed bold in row 1. */
  title: string
  /** Optional subtitle in row 2 (period, filters, ...). */
  subtitle?: string
  /** Company name, displayed right-aligned in row 1. */
  companyName: string
  /** ISO timestamp at which the workbook was generated. */
  generatedAt: string
}

export interface ColumnDef<TRow> {
  header: string
  /** Excel column letter / width hint. Default: auto. */
  width?: number
  /** Cell number format (e.g. '#,##0.00 "MAD"', 'dd/mm/yyyy'). */
  numFmt?: string
  /** Horizontal alignment override. */
  align?: 'left' | 'center' | 'right'
  /** Value extractor — return null for blank, otherwise primitive value. */
  value: (row: TRow) => string | number | Date | boolean | null
}

export interface SheetSpec<TRow> {
  /** Sheet tab name (max 31 chars per Excel spec). */
  name: string
  meta: SheetMeta
  columns: ColumnDef<TRow>[]
  rows: TRow[]
  /** Optional totals row, keyed by column index → label/value. */
  totals?: { label: string; values: Map<number, number> }
}

// Helper alias so callers can mix sheets with different row shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySheetSpec = SheetSpec<any>

/**
 * Build an Excel workbook with one sheet per spec. Returns a Uint8Array
 * suitable for streaming back via Route Handler. Accepts heterogeneous
 * row types — each spec is internally typed by its own TRow.
 */
export async function buildWorkbook(specs: AnySheetSpec[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'TMS Logistique'
  wb.created = new Date()

  for (const spec of specs) {
    const ws = wb.addWorksheet(spec.name.slice(0, 31), {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    })

    // Row 1 — title (left) + company (right)
    ws.mergeCells(1, 1, 1, Math.max(2, spec.columns.length - 1))
    const titleCell = ws.getCell(1, 1)
    titleCell.value = spec.meta.title
    titleCell.font = { bold: true, size: 14, color: { argb: BRAND_BLUE } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

    const companyCell = ws.getCell(1, spec.columns.length)
    companyCell.value = spec.meta.companyName
    companyCell.font = { bold: true, size: 11, color: { argb: BRAND_BLUE } }
    companyCell.alignment = { vertical: 'middle', horizontal: 'right' }

    // Row 2 — subtitle + generated timestamp
    if (spec.meta.subtitle) {
      ws.mergeCells(2, 1, 2, Math.max(2, spec.columns.length - 1))
      const sub = ws.getCell(2, 1)
      sub.value = spec.meta.subtitle
      sub.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    }
    const tsCell = ws.getCell(2, spec.columns.length)
    tsCell.value = `Généré le ${new Date(spec.meta.generatedAt).toLocaleString('fr-MA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`
    tsCell.font = { size: 9, color: { argb: 'FF6B7280' } }
    tsCell.alignment = { horizontal: 'right' }

    ws.getRow(3).height = 6 // spacer

    // Row 4 — column headers
    const headerRow = ws.getRow(4)
    spec.columns.forEach((col, idx) => {
      const c = headerRow.getCell(idx + 1)
      c.value = col.header
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_BLUE },
      }
      c.alignment = {
        horizontal: col.align ?? 'left',
        vertical: 'middle',
      }
      c.border = {
        top: { style: 'thin', color: { argb: BRAND_BORDER } },
        bottom: { style: 'thin', color: { argb: BRAND_BORDER } },
      }
    })
    headerRow.height = 22

    // Data rows starting at row 5
    spec.rows.forEach((row, rIdx) => {
      const r = ws.getRow(5 + rIdx)
      spec.columns.forEach((col, cIdx) => {
        const cell = r.getCell(cIdx + 1)
        const v = col.value(row)
        cell.value = v == null ? null : v
        if (col.numFmt) cell.numFmt = col.numFmt
        cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' }
        if ((rIdx & 1) === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_LIGHT },
          }
        }
        cell.border = {
          bottom: { style: 'hair', color: { argb: BRAND_BORDER } },
        }
      })
    })

    // Totals row (optional)
    if (spec.totals && spec.rows.length > 0) {
      const totalsRow = ws.getRow(5 + spec.rows.length)
      spec.columns.forEach((col, cIdx) => {
        const cell = totalsRow.getCell(cIdx + 1)
        const total = spec.totals!.values.get(cIdx)
        if (cIdx === 0) {
          cell.value = spec.totals!.label
          cell.font = { bold: true, size: 10 }
        } else if (total !== undefined) {
          cell.value = total
          if (col.numFmt) cell.numFmt = col.numFmt
          cell.font = { bold: true, size: 10 }
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        }
        cell.border = {
          top: { style: 'thin', color: { argb: BRAND_BLUE } },
          bottom: { style: 'thin', color: { argb: BRAND_BLUE } },
        }
        cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' }
      })
    }

    // Column widths
    spec.columns.forEach((col, idx) => {
      ws.getColumn(idx + 1).width = col.width ?? Math.max(12, col.header.length + 4)
    })

    // Auto-filter on the data range
    if (spec.rows.length > 0) {
      ws.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4 + spec.rows.length, column: spec.columns.length },
      }
    }
  }

  // exceljs returns ExcelJS.Buffer (ArrayBuffer-like). Wrap in Uint8Array so
  // Next's Web Response BodyInit accepts it directly.
  const out = await wb.xlsx.writeBuffer()
  return new Uint8Array(out as ArrayBuffer)
}

/**
 * Build a sane filename: `{slug}-{kind}-{YYYYMMDD-HHmm}.xlsx`.
 */
export function buildExportFilename(slug: string, kind: string): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '').toUpperCase() || 'EXPORT'
  return `${safeSlug}-${kind}-${stamp}.xlsx`
}

/**
 * Number formats most-used by MASLAK exports.
 */
export const FMT = {
  MAD: '#,##0.00 "MAD"',
  MAD_INT: '#,##0 "MAD"',
  KG: '#,##0.0 "kg"',
  KM: '#,##0 "km"',
  PCT: '0.0%',
  DATE: 'dd/mm/yyyy',
  DATETIME: 'dd/mm/yyyy hh:mm',
  INT: '#,##0',
} as const
