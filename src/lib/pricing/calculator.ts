import type { PricingRates, PriceBreakdown } from '@/types/app.types'

export function calculatePrice(
  distanceKm: number,
  rates: PricingRates,
  isUrgent: boolean
): PriceBreakdown {
  const distanceFee = distanceKm * rates.pricePerKm
  const subtotal = rates.baseFee + distanceFee
  const urgencyAmount = isUrgent ? subtotal * (rates.urgencySurchargePct / 100) : 0
  const priceExclTax = subtotal + urgencyAmount
  const vatAmount = priceExclTax * (rates.vatRatePct / 100)
  const totalPrice = priceExclTax + vatAmount

  return {
    baseFee: rates.baseFee,
    distanceFee: round2(distanceFee),
    urgencySurcharge: round2(urgencyAmount),
    priceExclTax: round2(priceExclTax),
    vatAmount: round2(vatAmount),
    totalPrice: round2(totalPrice),
    distanceKm,
    isUrgent,
    ratesSnapshot: rates,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function isUrgentDelivery(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return false
  const hoursUntil = (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60)
  return hoursUntil < 24
}

export function defaultRates(): PricingRates {
  return {
    baseFee: 100,
    pricePerKm: 5,
    urgencySurchargePct: 50,
    vatRatePct: 20,
    paymentTermsDays: 30,
  }
}
