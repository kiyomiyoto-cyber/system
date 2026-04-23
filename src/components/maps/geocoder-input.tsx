'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { GeocodingResult } from '@/types/app.types'

interface GeocoderInputProps {
  label: string
  placeholder?: string
  value?: string
  onSelect: (result: GeocodingResult) => void
  required?: boolean
}

export function GeocoderInput({ label, placeholder, value, onSelect, required }: GeocoderInputProps) {
  const tCommon = useTranslations('common')
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => setQuery(value ?? ''), [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?access_token=${token}&country=MA&language=fr&types=address,place,locality,neighborhood&limit=5`
        const res = await fetch(url)
        const json = await res.json()
        const mapped: GeocodingResult[] = (json.features ?? []).map((f: Record<string, unknown>) => ({
          id: f.id as string,
          placeName: f.place_name as string,
          center: f.center as [number, number],
          city: ((f.context as Array<{ id: string; text: string }>)?.find((c) => c.id.startsWith('place'))?.text) ?? (f.place_name as string).split(',')[0],
          country: 'Maroc',
        }))
        setResults(mapped)
        setIsOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  function handleSelect(r: GeocodingResult) {
    setQuery(r.placeName)
    setIsOpen(false)
    onSelect(r)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        <MapPin className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder ?? tCommon('typeAddress')}
          className="w-full rounded-lg border bg-background ps-9 pe-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-start text-sm hover:bg-accent transition-colors"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-foreground">{r.placeName}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
