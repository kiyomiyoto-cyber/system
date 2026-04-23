'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  locale: 'fr' | 'ar'
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setLocale: (locale: 'fr' | 'ar') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      locale: 'fr',
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'tms-ui-preferences' }
  )
)
