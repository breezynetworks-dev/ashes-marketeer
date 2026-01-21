"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2, MoreHorizontal, X, Check, LayoutGrid, Filter, SlidersHorizontal, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Type for API listing
type APIListing = {
  id: string
  seller: string
  item: string
  quantity: number
  rarity: string
  prices: {
    gold: number
    silver: number
    copper: number
    total: number
  }
  node: string
  uploadedBy: string | null
  timestamp: string
}

const rarityConfig: Record<string, { bg: string; text: string }> = {
  poor: { bg: "bg-rarity-poor", text: "text-white" },
  common: { bg: "bg-rarity-common", text: "text-black" },
  uncommon: { bg: "bg-rarity-uncommon", text: "text-white" },
  rare: { bg: "bg-rarity-rare", text: "text-white" },
  heroic: { bg: "bg-rarity-heroic", text: "text-white" },
  epic: { bg: "bg-rarity-epic", text: "text-white" },
  legendary: { bg: "bg-rarity-legendary", text: "text-white" },
}

// Format price value to gold/silver display
function formatPriceValue(value: number, unit: string): string {
  if (unit === "g") {
    return `${value}g`
  }
  // For silver values, show as silver (the history array stores raw silver values)
  return `${value}s`
}

// Get date label for index (days ago from today)
function getDateLabel(index: number, total: number): string {
  const daysAgo = total - 1 - index
  if (daysAgo === 0) return "Today"
  if (daysAgo === 1) return "1 day ago"
  return `${daysAgo} days ago`
}

// Mini sparkline component with hover tooltip
function Sparkline({ data, trend, unit = "s" }: { data: number[]; trend: "up" | "down" | "stable"; unit?: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 60
  const height = 20
  const padding = 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pointCoords = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return { x, y, value }
  })

  const points = pointCoords.map(p => `${p.x},${p.y}`).join(' ')
  const gradientId = `sparkline-${Math.random().toString(36).slice(2)}`
  const strokeColor = trend === "down" ? "#22c55e" : trend === "up" ? "#ef4444" : "#6b7280"

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const index = Math.round((x / rect.width) * (data.length - 1))
    setHoveredIndex(Math.max(0, Math.min(data.length - 1, index)))
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  const hoveredPoint = hoveredIndex !== null ? pointCoords[hoveredIndex] : null
  const tooltipLeftPercent = hoveredPoint ? (hoveredPoint.x / width) * 100 : 0

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-[60px] h-[20px] cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Fill area */}
        <path
          d={`M${padding},${height - padding} L${points} L${width - padding},${height - padding} Z`}
          fill={`url(#${gradientId})`}
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current price dot */}
        <circle
          cx={width - padding}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
          r={2.5}
          fill={strokeColor}
          className="drop-shadow-sm"
        />
        {/* Hover indicator */}
        {hoveredPoint && (
          <>
            {/* Vertical line */}
            <line
              x1={hoveredPoint.x}
              y1={padding}
              x2={hoveredPoint.x}
              y2={height - padding}
              stroke={strokeColor}
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.5}
            />
            {/* Hover dot */}
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={4}
              fill={strokeColor}
              stroke="white"
              strokeWidth={1.5}
            />
          </>
        )}
      </svg>
      {/* Tooltip */}
      {hoveredIndex !== null && hoveredPoint && (
        <div
          className="absolute z-50 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-popover border border-white/10 shadow-xl whitespace-nowrap pointer-events-none"
          style={{
            left: `${tooltipLeftPercent}%`,
            top: -4,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="text-foreground font-medium">{formatPriceValue(data[hoveredIndex], unit)}</div>
          <div className="text-muted-foreground text-[10px]">{getDateLabel(hoveredIndex, data.length)}</div>
        </div>
      )}
    </div>
  )
}

function RarityBadge({ rarity }: { rarity: string }) {
  const config = rarityConfig[rarity.toLowerCase()] || rarityConfig.common
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize",
        config.bg,
        config.text
      )}
      aria-label={`Rarity: ${rarity}`}
    >
      {rarity}
    </span>
  )
}

function PriceDisplay({ gold, silver, copper }: { gold: number; silver: number; copper: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm" aria-label={`${gold} gold, ${silver} silver, ${copper} copper`}>
      {gold > 0 && <span className="text-yellow-400">{gold}<span className="text-yellow-400/60 text-xs">g</span></span>}
      {silver > 0 && <span className="text-gray-300">{silver}<span className="text-gray-400/60 text-xs">s</span></span>}
      {copper > 0 && <span className="text-amber-500">{copper}<span className="text-amber-500/60 text-xs">c</span></span>}
      {gold === 0 && silver === 0 && copper === 0 && <span className="text-muted-foreground">Free</span>}
    </span>
  )
}

// Convert copper amount to appropriate display format
function formatCopperDifference(copperAmount: number): { amount: number; unit: string } {
  const absAmount = Math.abs(copperAmount)

  if (absAmount >= 10000) {
    // Display in gold (10000 copper = 1 gold)
    return { amount: Math.round(absAmount / 10000), unit: 'g' }
  } else if (absAmount >= 100) {
    // Display in silver (100 copper = 1 silver)
    return { amount: Math.round(absAmount / 100), unit: 's' }
  } else {
    // Display in copper
    return { amount: absAmount, unit: 'c' }
  }
}

function TrendIndicator({ trend }: { trend: { direction: string; amount: number; unit: string; history: number[] } | null }) {
  if (!trend) {
    return (
      <span className="text-muted-foreground/50 text-sm" aria-label="No price history available">
        No history
      </span>
    )
  }

  const sparkTrend = trend.direction === "down" ? "down" : trend.direction === "up" ? "up" : "stable"

  // Build aria-label for accessibility
  const ariaLabel = trend.direction === "none"
    ? "Price is stable, within 5% of average"
    : `Price is ${trend.amount}${trend.unit} ${trend.direction === "down" ? "below" : "above"} average - ${trend.direction === "down" ? "good deal" : "overpriced"}`

  return (
    <div className="flex items-center gap-3 w-full" aria-label={ariaLabel}>
      <div className="flex-1 min-w-0">
        <Sparkline data={trend.history} trend={sparkTrend} unit={trend.unit} />
      </div>
      <span
        className={cn(
          "text-xs font-medium font-mono shrink-0",
          trend.direction === "down" ? "text-emerald-400" :
          trend.direction === "up" ? "text-red-400" : "text-muted-foreground"
        )}
      >
        {trend.direction === "down" && `↓${trend.amount}${trend.unit} below avg`}
        {trend.direction === "up" && `↑${trend.amount}${trend.unit} above avg`}
        {trend.direction === "none" && "—"}
      </span>
    </div>
  )
}

function formatRelativeTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatStoreName(name: string): string {
  return name.replace(/'s Storefront$/i, '').replace(/s Storefront$/i, '')
}

function MarketPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [listings, setListings] = useState<APIListing[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<APIListing> | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [trendPeriod, setTrendPeriod] = useState<number>(14)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [trendData, setTrendData] = useState<Record<string, { direction: string; amount: number; unit: string; history: number[] } | null>>({})
  const editingRowRef = useRef<HTMLDivElement>(null)

  // Get filters from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "")
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || "")
  const [rarityFilter, setRarityFilter] = useState(searchParams.get('rarity') || "all")
  const [nodeFilter, setNodeFilter] = useState(searchParams.get('node') || "all")
  const [sortColumn, setSortColumn] = useState<string | null>(searchParams.get('sortBy') || "timestamp")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">((searchParams.get('sortOrder') as "asc" | "desc") || "desc")

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/trend_period_days')
        if (response.ok) {
          const data = await response.json()
          // Extract the days value from the JSONB structure
          const periodDays = typeof data.value === 'object' && data.value.days
            ? data.value.days
            : data.value
          setTrendPeriod(periodDays)
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
        toast.error('Connection failed, please try again')
      } finally {
        setIsLoadingSettings(false)
      }
    }

    fetchSettings()
  }, [])

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Click outside to cancel editing
  useEffect(() => {
    if (!editingId) return

    const handleClickOutside = (e: MouseEvent) => {
      if (editingRowRef.current && !editingRowRef.current.contains(e.target as Node)) {
        setEditingId(null)
        setEditValues(null)
        setValidationError(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingId])

  // Update URL query params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (rarityFilter !== 'all') params.set('rarity', rarityFilter)
    if (nodeFilter !== 'all') params.set('node', nodeFilter)
    if (sortColumn) params.set('sortBy', sortColumn)
    if (sortDirection) params.set('sortOrder', sortDirection)

    const queryString = params.toString()
    router.replace(`/market${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [debouncedSearch, rarityFilter, nodeFilter, sortColumn, sortDirection, router])

  // Fetch listings when query params change
  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (rarityFilter !== 'all') params.set('rarity', rarityFilter)
        if (nodeFilter !== 'all') params.set('node', nodeFilter)
        if (sortColumn) {
          // Map UI column names to API column names
          const sortByMap: Record<string, string> = {
            timestamp: 'createdAt',
            itemName: 'itemName',
            storeName: 'itemName', // API doesn't support seller sorting, fallback to itemName
            quantity: 'itemName', // API doesn't support quantity sorting, fallback to itemName
            price: 'totalPriceCopper',
            rarity: 'rarity',
            node: 'itemName', // API doesn't support node sorting, fallback to itemName
          }
          params.set('sortBy', sortByMap[sortColumn] || 'createdAt')
        }
        if (sortDirection) params.set('sortOrder', sortDirection)

        const response = await fetch(`/api/listings?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch listings')

        const data = await response.json()
        setListings(data.listings)
        setTotal(data.total)
      } catch (error) {
        console.error('Error fetching listings:', error)
        toast.error('Connection failed, please try again')
        setListings([])
        setTotal(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchListings()
  }, [debouncedSearch, rarityFilter, nodeFilter, sortColumn, sortDirection])

  // Fetch trend data when listings or trendPeriod changes
  useEffect(() => {
    const fetchTrendForListing = async (listing: APIListing): Promise<{ direction: string; amount: number; unit: string; history: number[] } | null> => {
      try {
        const params = new URLSearchParams({
          item_name: listing.item,
          rarity: listing.rarity,
          days: trendPeriod.toString()
        })

        const response = await fetch(`/api/trends?${params.toString()}`)
        if (!response.ok) return null

        const data = await response.json()

        // If no history, return null
        if (!data.history || data.history.length === 0) {
          return null
        }

        // Extract history prices (avgPrice is already in copper from the API)
        const historyPrices = data.history.map((h: { avgPrice: number }) => h.avgPrice)

        // Calculate difference between current price and period average
        const currentPrice = listing.prices.total // total is already in copper
        const periodAverage = data.periodAverage // already in copper
        const difference = currentPrice - periodAverage

        // Determine if stable (within 5% of average)
        const percentDiff = periodAverage > 0 ? Math.abs(difference / periodAverage) : 0
        const isStable = percentDiff < 0.05

        let direction: string
        if (isStable) {
          direction = "none"
        } else if (difference < 0) {
          direction = "down" // Price is below average (good deal)
        } else {
          direction = "up" // Price is above average (overpriced)
        }

        // Format the difference for display
        const { amount, unit } = formatCopperDifference(difference)

        return {
          direction,
          amount,
          unit,
          history: historyPrices
        }
      } catch (error) {
        // Silently fail for individual trend fetches - don't show toast for each failed trend
        console.error('Error fetching trend for listing:', error)
        return null
      }
    }

    const fetchTrends = async () => {
      if (listings.length === 0) {
        setTrendData({})
        return
      }

      // Fetch trends for all listings in parallel
      const trendPromises = listings.map(async (listing) => {
        const trend = await fetchTrendForListing(listing)
        return { id: listing.id, trend }
      })

      const results = await Promise.all(trendPromises)

      // Build trend data map
      const newTrendData: Record<string, { direction: string; amount: number; unit: string; history: number[] } | null> = {}
      results.forEach(({ id, trend }) => {
        newTrendData[id] = trend
      })

      setTrendData(newTrendData)
    }

    fetchTrends()
  }, [listings, trendPeriod])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const handleTrendPeriodChange = async (value: string | null) => {
    if (!value) return
    const newPeriod = parseInt(value, 10)
    setTrendPeriod(newPeriod)

    try {
      const response = await fetch('/api/settings/trend_period_days', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newPeriod }),
      })

      if (!response.ok) {
        throw new Error('Failed to update trend period')
      }

      // Trend data will be re-fetched automatically via useEffect dependency
    } catch (error) {
      console.error('Failed to update trend period:', error)
      toast.error('Failed to save trend period setting')
    }
  }

  const handleRarityFilterChange = (value: string | null) => {
    if (value) setRarityFilter(value)
  }

  const handleNodeFilterChange = (value: string | null) => {
    if (value) setNodeFilter(value)
  }

  const startEditing = (listing: APIListing) => {
    setEditingId(listing.id)
    setEditValues({
      ...listing
    })
    setValidationError(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditValues(null)
    setValidationError(null)
  }

  const handleSave = async () => {
    if (!editingId || !editValues) return

    // Validate quantity
    if (editValues.quantity !== undefined && editValues.quantity <= 0) {
      setValidationError("Quantity must be greater than 0")
      return
    }

    // Validate prices
    if (editValues.prices) {
      if (editValues.prices.gold < 0 || editValues.prices.silver < 0 || editValues.prices.copper < 0) {
        setValidationError("Prices cannot be negative")
        return
      }
    }

    setIsSaving(true)
    setValidationError(null)

    try {
      const response = await fetch(`/api/listings/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: editValues.item,
          seller_name: editValues.seller,
          quantity: editValues.quantity,
          rarity: editValues.rarity,
          node: editValues.node,
          price_gold: editValues.prices?.gold,
          price_silver: editValues.prices?.silver,
          price_copper: editValues.prices?.copper,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update listing')
      }

      const updatedListing = await response.json()

      // Update listings state
      setListings(listings.map(l => l.id === editingId ? updatedListing : l))

      // Clear edit state
      cancelEditing()
      toast.success('Listing updated')
    } catch (error) {
      console.error('Error updating listing:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes'
      setValidationError(errorMessage)
      toast.error('Connection failed, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  const updateEditValue = (field: keyof APIListing, value: any) => {
    if (!editValues) return
    setEditValues({ ...editValues, [field]: value })
  }

  const updatePriceValue = (field: 'gold' | 'silver' | 'copper', value: number) => {
    if (!editValues || !editValues.prices) return
    setEditValues({
      ...editValues,
      prices: {
        ...editValues.prices,
        [field]: value,
      }
    })
  }

  const handleDelete = async (listing: APIListing) => {
    // Store the deleted listing for potential undo
    const deletedListing = listing

    // Optimistically remove from UI
    setListings(listings.filter(l => l.id !== listing.id))
    setTotal(prev => prev - 1)

    try {
      // Call DELETE API
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete listing')
      }

      // Show toast with undo action
      toast('Listing deleted', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            // Call undo API
            try {
              const undoResponse = await fetch(`/api/listings/${listing.id}/undo`, {
                method: 'POST',
              })

              if (!undoResponse.ok) {
                throw new Error('Failed to undo delete')
              }

              // Restore listing to UI
              setListings(prev => [...prev, deletedListing])
              setTotal(prev => prev + 1)
              toast.success('Listing restored')
            } catch (error) {
              console.error('Error undoing delete:', error)
              toast.error('Failed to restore listing')
            }
          },
        },
      })
    } catch (error) {
      console.error('Error deleting listing:', error)
      // Restore listing if delete API failed
      setListings(prev => [...prev, deletedListing])
      setTotal(prev => prev + 1)
      toast.error('Failed to delete listing')
    }
  }

  const SortableHeader = ({ column, children, className }: { column: string; children: React.ReactNode; className?: string }) => {
    const isActive = sortColumn === column
    return (
      <button
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-xs font-medium uppercase tracking-wider",
          isActive ? "text-foreground" : "text-muted-foreground",
          className
        )}
        onClick={() => handleSort(column)}
      >
        {children}
        {isActive ? (
          sortDirection === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    )
  }

  return (
    <div className="px-8 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <LayoutGrid className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Market Explorer</h1>
            <p className="text-sm text-muted-foreground">Search and analyze marketplace listings</p>
          </div>
        </div>
        <Button render={<Link href="/upload" />} className="h-9 px-4 rounded-xl bg-gradient-to-r from-primary to-chart-3 hover:opacity-90 glow-primary-sm">
          <Upload className="size-4 mr-2" />
          Upload
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search items, stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 rounded-lg bg-white/[0.03] border-white/5 focus:border-primary/50 focus:bg-white/[0.05]"
            aria-label="Search listings"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 h-11 rounded-lg bg-white/[0.03] border border-white/5">
            <Filter className="size-4 text-muted-foreground mr-1" />
            {/* Rarity Filter */}
            <Select value={rarityFilter} onValueChange={handleRarityFilterChange}>
              <SelectTrigger className="w-[120px] h-7 border-0 bg-transparent text-sm" aria-label="Filter by rarity">
                <SelectValue placeholder="Rarity">{rarityFilter === 'all' ? 'Rarity' : rarityFilter.charAt(0).toUpperCase() + rarityFilter.slice(1)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Rarity</SelectItem>
                <SelectItem value="common">Common</SelectItem>
                <SelectItem value="uncommon">Uncommon</SelectItem>
                <SelectItem value="rare">Rare</SelectItem>
                <SelectItem value="heroic">Heroic</SelectItem>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="legendary">Legendary</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-4 bg-white/10" />

            {/* Node Filter */}
            <Select value={nodeFilter} onValueChange={handleNodeFilterChange}>
              <SelectTrigger className="w-[120px] h-7 border-0 bg-transparent text-sm" aria-label="Filter by node">
                <SelectValue placeholder="Node">{nodeFilter === 'all' ? 'Node' : nodeFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Node</SelectItem>
                <SelectItem value="New Aela">New Aela</SelectItem>
                <SelectItem value="Halcyon">Halcyon</SelectItem>
                <SelectItem value="Joeva">Joeva</SelectItem>
                <SelectItem value="Miraleth">Miraleth</SelectItem>
                <SelectItem value="Winstead">Winstead</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-4 bg-white/10" />

            {/* Trend Period */}
            <Select
              value={trendPeriod.toString()}
              onValueChange={handleTrendPeriodChange}
              disabled={isLoadingSettings}
            >
              <SelectTrigger className="w-[100px] h-7 border-0 bg-transparent text-sm" aria-label="Trend period">
                <SelectValue placeholder="Trend">Trend</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchQuery || rarityFilter !== "all" || nodeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setDebouncedSearch("")
                setRarityFilter("all")
                setNodeFilter("all")
              }}
              className="h-11 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" role="alert" aria-live="assertive">
          {validationError}
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="grid grid-cols-[minmax(180px,auto)_100px_120px_minmax(200px,auto)_minmax(160px,auto)_100px_100px_70px_1fr_72px] gap-x-8">
          {/* Table Header */}
          <div className="col-span-full grid grid-cols-subgrid gap-x-8 px-6 py-4 border-b border-white/5 bg-white/[0.02] items-center">
            <div className="pr-4"><SortableHeader column="itemName">Item Name</SortableHeader></div>
            <div className="px-4 flex justify-center"><SortableHeader column="quantity">Quantity</SortableHeader></div>
            <div className="px-4"><SortableHeader column="rarity">Rarity</SortableHeader></div>
            <div className="px-4 flex justify-center"><SortableHeader column="price">Price</SortableHeader></div>
            <div className="pr-4"><SortableHeader column="storeName">Store</SortableHeader></div>
            <div className="px-2"><SortableHeader column="node">Node</SortableHeader></div>
            <div className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Uploader</div>
            <div className="px-2 flex justify-center"><SortableHeader column="timestamp">Time</SortableHeader></div>
            <div className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Trend</div>
            <div />
          </div>

          {/* Table Body */}
          {isLoading ? (
            // Loading skeleton rows
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="col-span-full grid grid-cols-subgrid gap-x-8 px-6 py-5 items-center border-b border-white/5"
              >
                <Skeleton className="h-4 w-40" />
                <div className="flex justify-center">
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-6 w-20" />
                <div className="flex justify-center">
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-16" />
                <div className="flex justify-center">
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))
          ) : listings.length === 0 ? (
            <div className="col-span-10 px-6 py-16 text-center">
              {searchQuery || rarityFilter !== 'all' || nodeFilter !== 'all' ? (
                // No search results
                <>
                  <Search className="size-10 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground mb-1">No results found</p>
                  <p className="text-xs text-muted-foreground/50 mb-6">
                    No listings match "{searchQuery || 'your filters'}"
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("")
                      setDebouncedSearch("")
                      setRarityFilter("all")
                      setNodeFilter("all")
                    }}
                    className="border-white/10 bg-white/5 hover:bg-white/10"
                  >
                    <X className="size-4 mr-2" />
                    Clear filters
                  </Button>
                </>
              ) : (
                // No listings at all
                <>
                  <LayoutGrid className="size-10 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground mb-1">No marketplace data yet</p>
                  <p className="text-xs text-muted-foreground/50 mb-6">
                    Upload screenshots to start tracking prices
                  </p>
                  <Button
                    render={<Link href="/upload" />}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border-0"
                  >
                    <Upload className="size-4 mr-2" />
                    Go to Upload
                  </Button>
                </>
              )}
            </div>
          ) : (
            listings.map((listing) => {
              const isEditing = editingId === listing.id
              const displayValues = isEditing && editValues ? editValues : listing

              return (
                <div
                  key={listing.id}
                  ref={isEditing ? editingRowRef : null}
                  className={cn(
                    "col-span-full grid grid-cols-subgrid gap-x-8 px-6 py-5 items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors group",
                    isEditing && "bg-primary/5"
                  )}
                >
                  {/* Item */}
                  <div className="truncate pr-4">
                    <span className="text-sm text-muted-foreground">{listing.item}</span>
                  </div>

                  {/* Quantity */}
                  <div className="text-center px-4">
                    {isEditing ? (
                      <Input
                        type="number"
                        min="1"
                        value={editValues?.quantity || 0}
                        onChange={(e) => updateEditValue('quantity', parseInt(e.target.value) || 0)}
                        onKeyDown={handleKeyDown}
                        className="h-8 w-20 rounded-lg text-center bg-white/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={isSaving}
                        aria-label="Quantity"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{listing.quantity}</span>
                    )}
                  </div>

                  {/* Rarity */}
                  <div className="px-4">
                    <RarityBadge rarity={listing.rarity} />
                  </div>

                  {/* Price */}
                  <div className="px-4 flex justify-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-0.5 flex-wrap">
                        <Input
                          type="number"
                          min="0"
                          value={editValues?.prices?.gold || 0}
                          onChange={(e) => updatePriceValue('gold', parseInt(e.target.value) || 0)}
                          onKeyDown={handleKeyDown}
                          className="h-8 w-14 rounded-lg text-right bg-white/5 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={isSaving}
                          aria-label="Gold price"
                        />
                        <span className="text-yellow-400/60 text-xs mr-1">g</span>
                        <Input
                          type="number"
                          min="0"
                          max="99"
                          value={editValues?.prices?.silver || 0}
                          onChange={(e) => updatePriceValue('silver', parseInt(e.target.value) || 0)}
                          onKeyDown={handleKeyDown}
                          className="h-8 w-12 rounded-lg text-right bg-white/5 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={isSaving}
                          aria-label="Silver price"
                        />
                        <span className="text-gray-400/60 text-xs mr-1">s</span>
                        <Input
                          type="number"
                          min="0"
                          max="99"
                          value={editValues?.prices?.copper || 0}
                          onChange={(e) => updatePriceValue('copper', parseInt(e.target.value) || 0)}
                          onKeyDown={handleKeyDown}
                          className="h-8 w-12 rounded-lg text-right bg-white/5 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={isSaving}
                          aria-label="Copper price"
                        />
                        <span className="text-amber-500/60 text-xs">c</span>
                      </div>
                    ) : (
                      <PriceDisplay gold={listing.prices.gold} silver={listing.prices.silver} copper={listing.prices.copper} />
                    )}
                  </div>

                  {/* Store */}
                  <div className="truncate pr-4">
                    <span className="text-sm text-muted-foreground">{formatStoreName(listing.seller)}</span>
                  </div>

                  {/* Node */}
                  <div className="px-2">
                    <span className="text-sm px-2 py-1 rounded-md bg-white/5 text-muted-foreground whitespace-nowrap">
                      {listing.node}
                    </span>
                  </div>

                  {/* Uploaded By */}
                  <div className="px-2">
                    <span className="text-sm text-muted-foreground truncate block">
                      {listing.uploadedBy || '—'}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="text-center text-sm text-muted-foreground/60 font-mono whitespace-nowrap px-2">
                    {formatRelativeTime(listing.timestamp)}
                  </div>

                  {/* Trend */}
                  <div className="px-2">
                    <TrendIndicator trend={trendData[listing.id] || null} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={cancelEditing}
                          disabled={isSaving}
                          aria-label="Cancel editing"
                        >
                          <X className="size-4" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="text-emerald-400 hover:text-emerald-300"
                          onClick={handleSave}
                          disabled={isSaving}
                          aria-label="Save changes"
                        >
                          <Check className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground/50 hover:text-foreground"
                          onClick={() => startEditing(listing)}
                          aria-label="Edit listing"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground/50 hover:text-red-400"
                          onClick={() => handleDelete(listing)}
                          aria-label="Delete listing"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-between text-xs text-muted-foreground/60">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>Trend:</span>
            <span className="text-emerald-400">↓ Below avg</span>
            <span className="text-red-400">↑ Above avg</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Price:</span>
            <span className="text-yellow-400">Gold</span>
            <span className="text-gray-300">Silver</span>
            <span className="text-amber-500">Copper</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Listings:</span>
            <span className="text-foreground">{total.toLocaleString()} (across {new Set(listings.map(l => l.node)).size} nodes)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>Database Status:</span>
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400">Connected</span>
        </div>
      </div>
    </div>
  )
}

export default function MarketPage() {
  return (
    <Suspense fallback={
      <div className="px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-white/5 rounded-lg w-1/4" />
          <div className="h-64 bg-white/5 rounded-lg" />
        </div>
      </div>
    }>
      <MarketPageContent />
    </Suspense>
  )
}
