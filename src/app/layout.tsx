import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'TMS Logistique', template: '%s | TMS Logistique' },
  description: 'Système de gestion du transport — نظام إدارة الشحن',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
