import type { GeocodingResult, RouteResult } from '@/types/app.types'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  if (!MAPBOX_TOKEN || !query.trim()) return []

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`)
  url.searchParams.set('access_token', MAPBOX_TOKEN)
  url.searchParams.set('country', 'MA')
  url.searchParams.set('language', 'fr')
  url.searchParams.set('types', 'address,place,locality,neighborhood')
  url.searchParams.set('limit', '5')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) return []

  const json = await res.json()
  return (json.features ?? []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    placeName: f.place_name as string,
    center: f.center as [number, number],
    city: extractContext(f, 'place') ?? (f.place_name as string).split(',')[0],
    country: extractContext(f, 'country') ?? 'Maroc',
  }))
}

export async function getRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<RouteResult | null> {
  if (!MAPBOX_TOKEN) return null

  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`)
  url.searchParams.set('access_token', MAPBOX_TOKEN)
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('overview', 'full')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) return null

  const json = await res.json()
  const route = json.routes?.[0]
  if (!route) return null

  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry: route.geometry,
  }
}

function extractContext(feature: Record<string, unknown>, type: string): string | null {
  const ctx = feature.context as Array<{ id: string; text: string }> | undefined
  return ctx?.find((c) => c.id.startsWith(type))?.text ?? null
}
