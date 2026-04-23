import type { Tables, UserRole } from './database.types'

// Authenticated user profile (from public.users joined with auth.users)
export interface AuthUser {
  id: string
  email: string
  companyId: string | null
  role: UserRole
  fullName: string
  preferredLanguage: 'fr' | 'ar'
  avatarUrl: string | null
  isActive: boolean
}

// Server action standard response
export type ActionResult<T = null> =
  | { data: T; error: null }
  | { data: null; error: string }

// Shipment with joined relations (for list/detail views)
export type ShipmentWithRelations = Tables<'shipments'> & {
  client: Pick<Tables<'clients'>, 'id' | 'business_name' | 'contact_name' | 'contact_phone'> | null
  driver: Pick<Tables<'drivers'>, 'id' | 'full_name' | 'phone' | 'avatar_url'> | null
  vehicle: Pick<Tables<'vehicles'>, 'id' | 'plate_number' | 'brand' | 'model' | 'type'> | null
  documents?: Tables<'shipment_documents'>[]
  status_history?: Tables<'shipment_status_history'>[]
}

// Invoice with joined relations
export type InvoiceWithRelations = Tables<'invoices'> & {
  client: Pick<Tables<'clients'>, 'id' | 'business_name' | 'contact_name' | 'contact_email'> | null
  shipments?: Tables<'shipments'>[]
  payments?: Tables<'invoice_payments'>[]
}

// Driver with current vehicle
export type DriverWithVehicle = Tables<'drivers'> & {
  current_vehicle: Pick<Tables<'vehicles'>, 'id' | 'plate_number' | 'brand' | 'model' | 'type'> | null
}

// Pricing rates (from contract or defaults)
export interface PricingRates {
  baseFee: number
  pricePerKm: number
  urgencySurchargePct: number
  vatRate: number
  contractId: string | null
  source: 'contract' | 'default'
}

// Pricing calculation result
export interface PriceBreakdown {
  distanceKm: number
  baseFee: number
  distanceCost: number
  urgencySurcharge: number
  priceExclTax: number
  vatRate: number
  taxAmount: number
  priceInclTax: number
  isUrgent: boolean
  rates: PricingRates
}

// Mapbox geocoding result
export interface GeocodingResult {
  lat: number
  lng: number
  street: string
  city: string
  postalCode: string | null
  region: string | null
  country: string
  formattedAddress: string
}

// Route distance from Mapbox Directions API
export interface RouteResult {
  distanceKm: number
  durationMin: number
}

// Dashboard KPIs
export interface ShipmentKPIs {
  shipmentsToday: number
  shipmentsThisWeek: number
  shipmentsThisMonth: number
  activeShipments: number
  deliveredThisMonth: number
  onTimeRatePct: number | null
  revenueThisMonth: number
}

// Filter types for lists
export interface ShipmentFilters {
  status?: string[]
  clientId?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface InvoiceFilters {
  status?: string[]
  clientId?: string
  dateFrom?: string
  dateTo?: string
}
