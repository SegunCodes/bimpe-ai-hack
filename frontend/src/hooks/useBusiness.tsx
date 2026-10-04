'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Business } from '../lib/types'
import { usePolling } from './usePolling'

interface BusinessState {
  business: Business | null
  refresh: () => Promise<void>
}

const BusinessContext = createContext<BusinessState>({ business: null, refresh: async () => {} })

/** The signed-in business and its plan, refreshed every 15 seconds so call counts stay current. */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { data, refresh } = usePolling(api.me, 'me', 15_000)
  return <BusinessContext.Provider value={{ business: data, refresh }}>{children}</BusinessContext.Provider>
}

export const useBusiness = () => useContext(BusinessContext)
