// Haversine distance in meters between two geographic points.
// Used by the work-session check-in geofence on both client and server.
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface OfficeGeofence {
  lat: number
  lng: number
  radiusMeters: number
  label: string | null
  mapsUrl: string | null
}

// Returns true when a reported (lat, lng, accuracy) is inside the office
// geofence. Accuracy is added to the user's favor — a 50m-accurate fix
// 230m from the office still counts as inside a 200m radius.
export function isInsideOffice(
  position: { lat: number; lng: number; accuracy?: number | null },
  office: Pick<OfficeGeofence, 'lat' | 'lng' | 'radiusMeters'>,
): { inside: boolean; distance: number } {
  const distance = distanceMeters(
    { lat: position.lat, lng: position.lng },
    { lat: office.lat, lng: office.lng },
  )
  const slack = Math.max(0, position.accuracy ?? 0)
  return { inside: distance <= office.radiusMeters + slack, distance }
}
