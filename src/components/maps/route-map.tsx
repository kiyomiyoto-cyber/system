'use client'

import { useEffect, useRef } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'

interface RouteMapProps {
  pickup: { lng: number; lat: number; address: string }
  delivery: { lng: number; lat: number; address: string }
  routeGeometry?: GeoJSON.LineString | null
  className?: string
}

export function RouteMap({ pickup, delivery, routeGeometry, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    let mounted = true

    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!mounted || !containerRef.current) return
      mapboxgl.accessToken = token

      const bounds = new mapboxgl.LngLatBounds()
        .extend([pickup.lng, pickup.lat])
        .extend([delivery.lng, delivery.lat])

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        bounds,
        fitBoundsOptions: { padding: 60 },
      })
      mapRef.current = map

      // Markers
      new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([pickup.lng, pickup.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(pickup.address))
        .addTo(map)

      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([delivery.lng, delivery.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(delivery.address))
        .addTo(map)

      map.on('load', () => {
        if (routeGeometry) {
          map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: routeGeometry, properties: {} } })
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.85 },
          })
        }
      })
    })

    return () => {
      mounted = false
      if (mapRef.current) {
        ;(mapRef.current as { remove: () => void }).remove()
        mapRef.current = null
      }
    }
  }, [pickup.lng, pickup.lat, delivery.lng, delivery.lat, pickup.address, delivery.address, routeGeometry])

  return <div ref={containerRef} className={className ?? 'h-80 w-full rounded-xl border'} />
}
