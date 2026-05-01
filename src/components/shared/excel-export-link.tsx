import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExcelExportLinkProps {
  /** Absolute URL of the export Route Handler, with query params already applied. */
  href: string
  label: string
  className?: string
}

/**
 * Renders an anchor that downloads an XLSX produced by an /api/exports/*
 * Route Handler. Server-component friendly (uses next/link, no client JS).
 */
export function ExcelExportLink({ href, label, className }: ExcelExportLinkProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 focus-ring',
        className,
      )}
    >
      <FileSpreadsheet className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
