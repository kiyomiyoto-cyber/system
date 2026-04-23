import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { fr, arMA } from 'date-fns/locale'

type Locale = 'fr' | 'ar'

const dateFnsLocales: Record<Locale, Locale extends 'fr' ? typeof fr : typeof arMA> = {
  fr: fr,
  ar: arMA,
} as Record<Locale, typeof fr | typeof arMA>

export function formatMAD(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(
  date: string | Date | null | undefined,
  locale: Locale = 'fr',
  formatStr = 'dd/MM/yyyy',
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d, formatStr, { locale: dateFnsLocales[locale] })
}

export function formatDateTime(
  date: string | Date | null | undefined,
  locale: Locale = 'fr',
): string {
  return formatDate(date, locale, 'dd/MM/yyyy HH:mm')
}

export function formatRelativeTime(
  date: string | Date | null | undefined,
  locale: Locale = 'fr',
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return formatDistanceToNow(d, {
    addSuffix: true,
    locale: dateFnsLocales[locale],
  })
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null) return '—'
  return `${km.toFixed(1)} km`
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return '—'
  return `${kg.toFixed(1)} kg`
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '—'
  // Format Moroccan phone: +212 6XX-XXX-XXX
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('212') && cleaned.length === 12) {
    return `+212 ${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}-${cleaned.slice(9)}`
  }
  return phone
}

export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return `${value.toFixed(decimals)}%`
}

export function generateShipmentReference(companySlug: string, year: number, seq: number): string {
  return `${companySlug.toUpperCase()}-EXP-${String(year).slice(2)}-${String(seq).padStart(5, '0')}`
}

export function generateInvoiceNumber(companySlug: string, year: number, seq: number): string {
  return `${companySlug.toUpperCase()}-FAC-${String(year).slice(2)}-${String(seq).padStart(5, '0')}`
}
