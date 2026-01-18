"use client"

import { useState, useMemo, useEffect, type KeyboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMarketData } from "./market-data-provider"
import { Search, AlertCircle, ArrowUpDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatRelativeTime } from "@/utils/format-time"

type SearchItem = {
  name: string
  rarity: string
}

// Create a global state to persist search results
let globalSearchText = ""
let globalHasSearched = false
let globalSearchItems: SearchItem[] = []
let globalSortColumn = "item"
let globalSortDirection = "asc"
let globalSelectedNode = "any" // Set default to "any"

type SortDirection = "asc" | "desc"

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

export default function BulkSearch() {
  const { marketData, lastUpdated } = useMarketData()
  const [searchText, setSearchText] = useState(globalSearchText)
  const [hasSearched, setHasSearched] = useState(globalHasSearched)
  const [searchItems, setSearchItems] = useState<SearchItem[]>(globalSearchItems)
  const [sortColumn, setSortColumn] = useState<string>(globalSortColumn)
  const [sortDirection, setSortDirection] = useState<SortDirection>(globalSortDirection as SortDirection)
  const [selectedNode, setSelectedNode] = useState(globalSelectedNode)

  // Update global state when local state changes
  useEffect(() => {
    globalSearchText = searchText
    globalHasSearched = hasSearched
    globalSearchItems = searchItems
    globalSortColumn = sortColumn
    globalSortDirection = sortDirection
    globalSelectedNode = selectedNode
  }, [searchText, hasSearched, searchItems, sortColumn, sortDirection, selectedNode])

  const filteredData = useMemo(() => {
    if (!hasSearched || searchItems.length === 0) return []

    // Get all matching items for each search term
    let allResults: any[] = []

    searchItems.forEach((searchItem) => {
      const matchingItems = marketData.filter((item) => {
        const matchesName = item.item.toLowerCase() === searchItem.name.toLowerCase()
        const matchesRarity = !searchItem.rarity || item.rarity.toLowerCase() === searchItem.rarity.toLowerCase()
        const matchesNode = selectedNode && selectedNode !== "any" ? item.node === selectedNode : true
        return matchesName && matchesRarity && matchesNode
      })

      // Add all matching items to results
      allResults = [...allResults, ...matchingItems]
    })

    // Sort the results
    return allResults.sort((a, b) => {
      let comparison = 0

      // Sort by the selected column
      if (sortColumn === "item") {
        comparison = a.item.localeCompare(b.item)
      } else if (sortColumn === "rarity") {
        // Use custom rarity ranking instead of alphabetical sorting
        comparison = getRarityRank(a.rarity) - getRarityRank(b.rarity)
      } else if (sortColumn === "quantity") {
        comparison = a.quantity - b.quantity
      } else if (sortColumn === "price") {
        comparison = (a.totalPrice || 0) - (b.totalPrice || 0)
      } else if (sortColumn === "store") {
        comparison = a.storeName.localeCompare(b.storeName)
      } else if (sortColumn === "node") {
        comparison = a.node.localeCompare(b.node)
      } else if (sortColumn === "timestamp") {
        comparison = a.timestamp.localeCompare(b.timestamp)
      } else if (sortColumn === "avgPrice") {
        comparison = (a.avgTotalPrice || 0) - (b.avgTotalPrice || 0)
      }

      // Reverse the comparison if sorting in descending order
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [marketData, searchItems, hasSearched, sortColumn, sortDirection, selectedNode])

  const handleSearch = () => {
    if (!searchText.trim()) return

    // Parse the search text into items and rarities
    const lines = searchText.split("\n").filter((line) => line.trim())
    const parsedItems: SearchItem[] = lines.map((line) => {
      const parts = line.split(",").map((part) => part.trim())
      return {
        name: parts[0].replace(/"/g, ""),
        rarity: parts[1] ? parts[1].replace(/"/g, "") : "",
      }
    })

    setSearchItems(parsedItems)
    setHasSearched(true)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Only trigger search on Ctrl+Enter or Cmd+Enter to allow normal Enter for new lines
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSearch()
    }
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
        <CardTitle className="text-amber-500">Bulk Search</CardTitle>
        <CardDescription className="text-gray-300">Search for multiple items at once</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="bulk-search" className="text-sm font-medium mb-2 block text-gray-300">
              Item Names
            </label>
            <Textarea
              id="bulk-search"
              placeholder={`iron, epic
copper, uncommon
tin, legendary`}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[150px] bg-gray-700 border-gray-600 text-gray-200"
            />
          </div>
          <div className="w-full sm:w-48">
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
            <div className="mt-4">
              <Button
                onClick={handleSearch}
                disabled={!searchText.trim()}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </div>

        {hasSearched && marketData.length === 0 && (
          <Alert className="mb-6 bg-amber-900/30 border-amber-800/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-gray-200">
              Please load market data first using the "Load Market Data" button above.
            </AlertDescription>
          </Alert>
        )}

        {hasSearched && marketData.length > 0 && filteredData.length === 0 && (
          <Alert className="mb-6 bg-blue-900/30 border-blue-800/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-gray-200">No items found matching your search criteria.</AlertDescription>
          </Alert>
        )}

        {filteredData.length > 0 && (
          <>
            <div className="text-sm text-gray-400 mb-2">Found {filteredData.length} results</div>
            <div className="rounded-md border border-gray-700 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-900">
                  <TableRow>
                    <SortableHeader column="item" label="Item" />
                    <SortableHeader column="rarity" label="Rarity" />
                    <SortableHeader column="quantity" label="Quantity" />
                    <SortableHeader column="price" label="Price" />
                    <SortableHeader column="avgPrice" label="Avg Price (14d)" />
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
                      <TableCell className="text-gray-200">{item.quantity}</TableCell>
                      <TableCell>{formatPrice(item.gold, item.silver, item.copper)}</TableCell>
                      <TableCell>
                        {formatAvgPrice(item.avgGold || 0, item.avgSilver || 0, item.avgCopper || 0)}
                      </TableCell>
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

