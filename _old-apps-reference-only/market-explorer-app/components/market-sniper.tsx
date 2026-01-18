"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMarketData } from "./market-data-provider"
import { AlertCircle, ArrowUpDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatRelativeTime } from "@/utils/format-time"

// Create a global state to persist search results
let globalSearchTerm = ""
let globalSelectedRarity = "any" // Set default to "any"
let globalSelectedNode = "any"
let globalMatchType = "partial"
let globalPercentageThreshold = "20"
let globalSortColumn = "discount"
let globalSortDirection = "desc"

type SortDirection = "asc" | "desc"
type MatchType = "partial" | "exact"

// Helper function to get rarity rank for sorting
const getRarityRank = (rarity: string): number => {
  switch (rarity.toLowerCase()) {
    case "common":
      return 1
    case "uncommon":
      return 2
    case "rare":
      return 3
    case "heroic":
      return 4
    case "epic":
      return 5
    case "legendary":
      return 6
    default:
      return 0 // Unknown rarities will be sorted first
  }
}

export default function MarketSniper() {
  const { marketData, lastUpdated } = useMarketData()
  const [searchTerm, setSearchTerm] = useState(globalSearchTerm)
  const [selectedRarity, setSelectedRarity] = useState(globalSelectedRarity)
  const [selectedNode, setSelectedNode] = useState(globalSelectedNode)
  const [matchType, setMatchType] = useState<MatchType>(globalMatchType as MatchType)
  const [percentageThreshold, setPercentageThreshold] = useState(globalPercentageThreshold)
  const [sortColumn, setSortColumn] = useState<string>(globalSortColumn)
  const [sortDirection, setSortDirection] = useState<SortDirection>(globalSortDirection as SortDirection)
  const [isLoading, setIsLoading] = useState(false)

  // Update global state when local state changes
  useEffect(() => {
    globalSearchTerm = searchTerm
    globalSelectedRarity = selectedRarity
    globalSelectedNode = selectedNode
    globalMatchType = matchType
    globalPercentageThreshold = percentageThreshold
    globalSortColumn = sortColumn
    globalSortDirection = sortDirection
  }, [searchTerm, selectedRarity, selectedNode, matchType, percentageThreshold, sortColumn, sortDirection])

  const filteredData = useMemo(() => {
    // Set a reasonable limit to avoid performance issues
    const maxResults = 100
    const thresholdValue = Number.parseFloat(percentageThreshold) || 0

    // Filter items that have both current price and historical average price
    return marketData
      .filter((item) => {
        // Skip items without historical data
        if (!item.avgTotalPrice) return false

        // Calculate discount percentage
        const currentPrice = item.totalPrice || 0
        const historicalPrice = item.avgTotalPrice || 0

        // Skip if historical price is 0 to avoid division by zero
        if (historicalPrice === 0) return false

        // Calculate how much cheaper the current price is compared to historical
        const discountPercentage = ((historicalPrice - currentPrice) / historicalPrice) * 100

        // Only include items that are cheaper than historical by at least the threshold percentage
        if (discountPercentage < thresholdValue) return false

        // Match based on selected match type
        const matchesName = searchTerm
          ? matchType === "partial"
            ? item.item.toLowerCase().includes(searchTerm.toLowerCase())
            : item.item.toLowerCase() === searchTerm.toLowerCase()
          : true

        const matchesRarity =
          selectedRarity && selectedRarity !== "any" ? item.rarity.toLowerCase() === selectedRarity.toLowerCase() : true
        const matchesNode = selectedNode && selectedNode !== "any" ? item.node === selectedNode : true

        return matchesName && matchesRarity && matchesNode
      })
      .map((item) => {
        // Add discount percentage to each item for display and sorting
        const currentPrice = item.totalPrice || 0
        const historicalPrice = item.avgTotalPrice || 0
        const discountPercentage = ((historicalPrice - currentPrice) / historicalPrice) * 100

        return {
          ...item,
          discountPercentage,
        }
      })
      .sort((a, b) => {
        let comparison = 0

        // Sort by the selected column
        if (sortColumn === "item") {
          comparison = a.item.localeCompare(b.item)
        } else if (sortColumn === "rarity") {
          comparison = getRarityRank(a.rarity) - getRarityRank(b.rarity)
        } else if (sortColumn === "quantity") {
          comparison = a.quantity - b.quantity
        } else if (sortColumn === "price") {
          comparison = (a.totalPrice || 0) - (b.totalPrice || 0)
        } else if (sortColumn === "avgPrice") {
          comparison = (a.avgTotalPrice || 0) - (b.avgTotalPrice || 0)
        } else if (sortColumn === "discount") {
          comparison = a.discountPercentage - b.discountPercentage
        } else if (sortColumn === "store") {
          comparison = a.storeName.localeCompare(b.storeName)
        } else if (sortColumn === "node") {
          comparison = a.node.localeCompare(b.node)
        } else if (sortColumn === "timestamp") {
          comparison = a.timestamp.localeCompare(b.timestamp)
        }

        // Reverse the comparison if sorting in descending order
        return sortDirection === "asc" ? comparison : -comparison
      })
      .slice(0, maxResults) // Limit results to avoid performance issues
  }, [marketData, searchTerm, selectedRarity, selectedNode, matchType, percentageThreshold, sortColumn, sortDirection])

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setIsLoading(true)
    // Use a small timeout to avoid excessive filtering during rapid typing
    setTimeout(() => {
      setIsLoading(false)
    }, 300)
  }

  const handlePercentageChange = (value: string) => {
    // Only allow numbers and decimal point
    const sanitizedValue = value.replace(/[^\d.]/g, "")
    setPercentageThreshold(sanitizedValue)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // If already sorting by this column, toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Otherwise, sort by this column in ascending order
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const formatPrice = (gold: number, silver: number, copper: number) => {
    return (
      <div className="flex items-center gap-1">
        <span className="text-yellow-500">{gold}</span>
        <span className="text-gray-400">g</span>
        <span className="text-gray-300">{silver}</span>
        <span className="text-gray-400">s</span>
        <span className="text-amber-600">{copper}</span>
        <span className="text-gray-400">c</span>
      </div>
    )
  }

  const formatAvgPrice = (avgGold: number, avgSilver: number, avgCopper: number) => {
    if (avgGold === 0 && avgSilver === 0 && avgCopper === 0) {
      return <span className="text-gray-500">No data</span>
    }

    return (
      <div className="flex items-center gap-1">
        <span className="text-yellow-500">{avgGold}</span>
        <span className="text-gray-400">g</span>
        <span className="text-gray-300">{avgSilver}</span>
        <span className="text-gray-400">s</span>
        <span className="text-amber-600">{avgCopper}</span>
        <span className="text-gray-400">c</span>
      </div>
    )
  }

  const SortableHeader = ({ column, label }: { column: string; label: string }) => (
    <TableHead
      className="text-gray-300 cursor-pointer"
      onClick={() => handleSort(column)}
      style={{ backgroundColor: "transparent", pointerEvents: "auto" }}
    >
      <div className="flex items-center">
        {label}
        <ArrowUpDown className="ml-1 h-4 w-4" />
      </div>
    </TableHead>
  )

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-amber-500">Market Sniper</CardTitle>
        <CardDescription className="text-gray-300">
          Find items that are cheaper than their historical average price
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="item-search" className="text-sm font-medium mb-2 block text-gray-300">
              Item Name
            </label>
            <Input
              id="item-search"
              placeholder="Start typing to search..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-gray-700 border-gray-600 text-gray-200"
            />
          </div>
          <div className="w-full sm:w-36">
            <label htmlFor="percentage-threshold" className="text-sm font-medium mb-2 block text-gray-300">
              % Cheaper
            </label>
            <Input
              id="percentage-threshold"
              placeholder="20"
              value={percentageThreshold}
              onChange={(e) => handlePercentageChange(e.target.value)}
              className="bg-gray-700 border-gray-600 text-gray-200"
            />
          </div>
          <div className="w-full sm:w-36">
            <label htmlFor="match-type-select" className="text-sm font-medium mb-2 block text-gray-300">
              Match Type
            </label>
            <Select value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}>
              <SelectTrigger id="match-type-select" className="bg-gray-700 border-gray-600 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="partial" className="text-gray-200">
                  Partial
                </SelectItem>
                <SelectItem value="exact" className="text-gray-200">
                  Exact
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-36">
            <label htmlFor="rarity-select" className="text-sm font-medium mb-2 block text-gray-300">
              Item Rarity
            </label>
            <Select value={selectedRarity} onValueChange={setSelectedRarity}>
              <SelectTrigger id="rarity-select" className="bg-gray-700 border-gray-600 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="any" className="text-gray-200">
                  Any Rarity
                </SelectItem>
                <SelectItem value="Common" className="text-gray-200">
                  Common
                </SelectItem>
                <SelectItem value="Uncommon" className="text-gray-200">
                  Uncommon
                </SelectItem>
                <SelectItem value="Rare" className="text-gray-200">
                  Rare
                </SelectItem>
                <SelectItem value="Heroic" className="text-gray-200">
                  Heroic
                </SelectItem>
                <SelectItem value="Epic" className="text-gray-200">
                  Epic
                </SelectItem>
                <SelectItem value="Legendary" className="text-gray-200">
                  Legendary
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-36">
            <label htmlFor="node-select" className="text-sm font-medium mb-2 block text-gray-300">
              Node
            </label>
            <Select value={selectedNode} onValueChange={setSelectedNode}>
              <SelectTrigger id="node-select" className="bg-gray-700 border-gray-600 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="any" className="text-gray-200">
                  Any Node
                </SelectItem>
                <SelectItem value="New Aela" className="text-gray-200">
                  New Aela
                </SelectItem>
                <SelectItem value="Halcyon" className="text-gray-200">
                  Halcyon
                </SelectItem>
                <SelectItem value="Joeva" className="text-gray-200">
                  Joeva
                </SelectItem>
                <SelectItem value="Miraleth" className="text-gray-200">
                  Miraleth
                </SelectItem>
                <SelectItem value="Winstead" className="text-gray-200">
                  Winstead
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {marketData.length === 0 && (
          <Alert className="mb-6 bg-amber-900/30 border-amber-800/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-gray-200">
              Please load market data first using the "Load Market Data" button above.
            </AlertDescription>
          </Alert>
        )}

        {marketData.length > 0 && filteredData.length === 0 && (
          <Alert className="mb-6 bg-blue-900/30 border-blue-800/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-gray-200">
              No items found that are at least {percentageThreshold}% cheaper than their historical average.
            </AlertDescription>
          </Alert>
        )}

        {filteredData.length > 0 && (
          <>
            <div className="text-sm text-gray-400 mb-2">
              Found {filteredData.length} {filteredData.length === 100 ? "or more " : ""}results
            </div>
            <div className="rounded-md border border-gray-700 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-900">
                  <TableRow>
                    <SortableHeader column="item" label="Item" />
                    <SortableHeader column="rarity" label="Rarity" />
                    <SortableHeader column="discount" label="Discount %" />
                    <SortableHeader column="price" label="Current Price" />
                    <SortableHeader column="avgPrice" label="Avg Price (14d)" />
                    <SortableHeader column="quantity" label="Quantity" />
                    <SortableHeader column="store" label="Store" />
                    <SortableHeader column="node" label="Node" />
                    <SortableHeader column="timestamp" label="Updated" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => (
                    <TableRow key={index} className="border-gray-700 hover:bg-gray-700/50">
                      <TableCell className="font-medium text-gray-200">{item.item}</TableCell>
                      <TableCell>
                        {item.rarity === "Heroic" ? (
                          <span
                            style={{ backgroundColor: "#b79c3e" }}
                            className="px-2 py-1 rounded-full text-xs text-white"
                          >
                            {item.rarity}
                          </span>
                        ) : (
                          <span
                            className={`
                              px-2 py-1 rounded-full text-xs
                              ${item.rarity === "Common" && "bg-white text-gray-800"}
                              ${item.rarity === "Uncommon" && "bg-green-600 text-green-100"}
                              ${item.rarity === "Rare" && "bg-blue-600 text-blue-100"}
                              ${item.rarity === "Epic" && "bg-purple-900 text-purple-100"}
                              ${item.rarity === "Legendary" && "bg-orange-600 text-orange-100"}
                            `}
                          >
                            {item.rarity}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-green-400 font-medium">{item.discountPercentage.toFixed(1)}%</span>
                      </TableCell>
                      <TableCell>{formatPrice(item.gold, item.silver, item.copper)}</TableCell>
                      <TableCell>
                        {formatAvgPrice(item.avgGold || 0, item.avgSilver || 0, item.avgCopper || 0)}
                      </TableCell>
                      <TableCell className="text-gray-200">{item.quantity}</TableCell>
                      <TableCell className="text-gray-200">{item.storeName}</TableCell>
                      <TableCell className="text-gray-200">{item.node}</TableCell>
                      <TableCell className="text-gray-200">{formatRelativeTime(item.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

