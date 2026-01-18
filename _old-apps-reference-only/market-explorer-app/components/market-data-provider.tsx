"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

// Define the market item type
export type MarketItem = {
  // We're keeping date for backward compatibility
  date?: string
  timestamp: string
  node: string
  storeName: string
  item: string
  quantity: number
  rarity: string
  gold: number
  silver: number
  copper: number
  // Calculated total price in copper for sorting
  totalPrice?: number
  // Average price data (14 days)
  avgGold?: number
  avgSilver?: number
  avgCopper?: number
  avgTotalPrice?: number
}

// Define the context type
type MarketDataContextType = {
  marketData: MarketItem[]
  setMarketData: (data: MarketItem[]) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  lastUpdated: string | null
  setLastUpdated: (date: string | null) => void
  importStats: {
    liveRows: number
    liveNodes: number
    historicalRows: number
    historicalNodes: number
  } | null
  setImportStats: (
    stats: {
      liveRows: number
      liveNodes: number
      historicalRows: number
      historicalNodes: number
    } | null,
  ) => void
}

// Create the context with default values
const MarketDataContext = createContext<MarketDataContextType>({
  marketData: [],
  setMarketData: () => {},
  isLoading: false,
  setIsLoading: () => {},
  lastUpdated: null,
  setLastUpdated: () => {},
  importStats: null,
  setImportStats: () => {},
})

// Hook to use the market data context
export const useMarketData = () => useContext(MarketDataContext)

// Provider component
export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [marketData, setMarketData] = useState<MarketItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [importStats, setImportStats] = useState<{
    liveRows: number
    liveNodes: number
    historicalRows: number
    historicalNodes: number
  } | null>(null)

  return (
    <MarketDataContext.Provider
      value={{
        marketData,
        setMarketData,
        isLoading,
        setIsLoading,
        lastUpdated,
        setLastUpdated,
        importStats,
        setImportStats,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  )
}

