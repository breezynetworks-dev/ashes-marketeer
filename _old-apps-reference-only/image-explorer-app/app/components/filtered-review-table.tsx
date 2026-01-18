"use client"

import { useState, useEffect } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CSVRow } from "./data-table"

type FilterType =
  | "worth-4-gold-or-more"
  | "low-rarity-high-price"
  | "high-rarity-low-price"
  | "epic-rarity-all"
  | "legendary-rarity-all"
  | "shopping-list"

interface FilteredReviewTableProps {
  data: CSVRow[]
  onDataChange: (newData: CSVRow[]) => void
  filterType: FilterType
  shoppingList?: string
}

// Helper function to check if a rarity is low (common, uncommon, rare, heroic)
const isLowRarity = (rarity: string): boolean => {
  const lowRarities = ["common", "uncommon", "rare", "heroic"]
  return lowRarities.includes(rarity.toLowerCase())
}

// Helper function to check if a rarity is high (epic, legendary)
const isHighRarity = (rarity: string): boolean => {
  const highRarities = ["epic", "legendary"]
  return highRarities.includes(rarity.toLowerCase())
}

// Helper function to check if a rarity is epic
const isEpicRarity = (rarity: string): boolean => {
  return rarity.toLowerCase() === "epic"
}

// Helper function to check if a rarity is legendary
const isLegendaryRarity = (rarity: string): boolean => {
  return rarity.toLowerCase() === "legendary"
}

// Helper function to calculate total value in silver
const getTotalValueInSilver = (gold: string, silver: string, copper: string): number => {
  const goldValue = Number.parseInt(gold || "0", 10) * 100 // 1 gold = 100 silver
  const silverValue = Number.parseInt(silver || "0", 10)
  const copperValue = Math.floor(Number.parseInt(copper || "0", 10) / 100) // 100 copper = 1 silver

  return goldValue + silverValue + copperValue
}

// Helper function to parse shopping list
const parseShoppingList = (shoppingList: string): Array<{ item: string; rarity: string }> => {
  if (!shoppingList) return []

  // Split by lines first
  const lines = shoppingList.split(/\n/).filter((line) => line.trim() !== "")

  const result = []

  // Process each line
  for (const line of lines) {
    // Split line by comma
    const parts = line.split(/,\s*/)

    // Check if we have at least 2 parts (item and rarity)
    if (parts.length >= 2) {
      // Clean up quotes if present
      const itemName = parts[0].replace(/^["']|["']$/g, "").trim()
      const rarity = parts[1].replace(/^["']|["']$/g, "").trim()

      if (itemName && rarity) {
        result.push({ item: itemName.toLowerCase(), rarity: rarity.toLowerCase() })
      }
    }
  }

  return result
}

export function FilteredReviewTable({ data, onDataChange, filterType, shoppingList = "" }: FilteredReviewTableProps) {
  // Local state for edited data
  const [editedData, setEditedData] = useState<CSVRow[]>([])
  const [originalData, setOriginalData] = useState<CSVRow[]>([])
  const [parsedShoppingList, setParsedShoppingList] = useState<Array<{ item: string; rarity: string }>>([])

  // Parse shopping list when it changes
  useEffect(() => {
    if (filterType === "shopping-list" && shoppingList) {
      setParsedShoppingList(parseShoppingList(shoppingList))
    }
  }, [shoppingList, filterType])

  useEffect(() => {
    if (!data || data.length === 0) {
      return
    }

    // Apply the appropriate filter based on filterType
    let filtered: CSVRow[] = []

    switch (filterType) {
      case "worth-4-gold-or-more":
        filtered = data.filter((row) => {
          const goldValue = Number.parseInt(row.gold || "0", 10)
          return goldValue >= 4
        })
        break

      case "low-rarity-high-price":
        filtered = data.filter((row) => {
          const goldValue = Number.parseInt(row.gold || "0", 10)
          return isLowRarity(row.rarity) && goldValue >= 1
        })
        break

      case "high-rarity-low-price":
        filtered = data.filter((row) => {
          const totalSilverValue = getTotalValueInSilver(row.gold, row.silver, row.copper)
          return isHighRarity(row.rarity) && totalSilverValue <= 99
        })
        break

      case "epic-rarity-all":
        filtered = data.filter((row) => {
          return isEpicRarity(row.rarity)
        })
        break

      case "legendary-rarity-all":
        filtered = data.filter((row) => {
          return isLegendaryRarity(row.rarity)
        })
        break

      case "shopping-list":
        if (parsedShoppingList.length > 0) {
          filtered = data.filter((row) => {
            return parsedShoppingList.some(
              (item) =>
                // Use exact match instead of includes
                row.item.toLowerCase() === item.item && row.rarity.toLowerCase() === item.rarity,
            )
          })
        }
        break
    }

    setEditedData(filtered)
    setOriginalData(JSON.parse(JSON.stringify(filtered))) // Deep copy for comparison
  }, [data, filterType, parsedShoppingList])

  const handlePriceChange = (index: number, field: "gold" | "silver" | "copper", value: string) => {
    // Ensure value is a valid number
    const numValue = value === "" ? "0" : value
    if (!/^\d+$/.test(numValue)) return

    // Update the local edited data
    const newData = [...editedData]
    newData[index] = { ...newData[index], [field]: numValue }
    setEditedData(newData)

    // Find and update the corresponding row in the original data
    const updatedOriginalData = [...data]
    const editedRow = newData[index]

    // Find the matching row in the original data
    const originalIndex = updatedOriginalData.findIndex((row) => isMatchingRow(row, editedRow))
    if (originalIndex !== -1) {
      // Update only the specific field that changed
      updatedOriginalData[originalIndex] = {
        ...updatedOriginalData[originalIndex],
        [field]: numValue,
      }

      // Immediately update the parent component with the changes
      onDataChange(updatedOriginalData)
    }
  }

  // Add a new handler for quantity changes
  const handleQuantityChange = (index: number, value: string) => {
    // Ensure value is a valid number
    const numValue = value === "" ? "1" : value
    if (!/^\d+$/.test(numValue)) return

    // Update the local edited data
    const newData = [...editedData]
    const oldQuantity = newData[index].quantity // Store the old quantity
    newData[index] = { ...newData[index], quantity: numValue }
    setEditedData(newData)

    // Find and update the corresponding row in the original data
    const updatedOriginalData = [...data]
    const editedRow = newData[index]

    // Find the matching row in the original data - use a modified matching function
    // that doesn't include quantity in the comparison
    const originalIndex = updatedOriginalData.findIndex(
      (row) =>
        row.storeName === editedRow.storeName &&
        row.item === editedRow.item &&
        row.rarity === editedRow.rarity &&
        // For quantity updates, we need to match the original quantity
        row.quantity === oldQuantity,
    )

    if (originalIndex !== -1) {
      // Update the quantity field
      updatedOriginalData[originalIndex] = {
        ...updatedOriginalData[originalIndex],
        quantity: numValue,
      }

      // Immediately update the parent component with the changes
      onDataChange(updatedOriginalData)
    }
  }

  const handleDelete = (index: number) => {
    const deletedRow = editedData[index]

    // Remove from local edited data
    const newEditedData = [...editedData]
    newEditedData.splice(index, 1)
    setEditedData(newEditedData)

    // Find and remove the corresponding row from the original data
    const updatedOriginalData = data.filter((row) => !isMatchingRow(row, deletedRow))

    // Immediately update the parent component with the changes
    onDataChange(updatedOriginalData)
  }

  // Helper function to check if two rows are the same
  const isMatchingRow = (row1: CSVRow, row2: CSVRow) => {
    return (
      row1.storeName === row2.storeName &&
      row1.item === row2.item &&
      row1.quantity === row2.quantity &&
      row1.rarity === row2.rarity
    )
  }

  // Get the appropriate message based on the filter type
  const getEmptyMessage = (): string => {
    switch (filterType) {
      case "worth-4-gold-or-more":
        return "No items worth 4 gold or more found. This filter shows items with a gold value of 4 or higher."
      case "low-rarity-high-price":
        return "No low rarity items with high price found. This filter shows Common, Uncommon, Rare, or Heroic items with a gold value of 1 or higher."
      case "high-rarity-low-price":
        return "No high rarity items with low price found. This filter shows Epic or Legendary items with a total value of 99 silver or less (less than 1 gold)."
      case "epic-rarity-all":
        return "No Epic rarity items found. This filter shows all items with Epic rarity."
      case "legendary-rarity-all":
        return "No Legendary rarity items found. This filter shows all items with Legendary rarity."
      case "shopping-list":
        return "No items from your shopping list found. Make sure your items are in the format: Item name, rarity with each item on a new line."
      default:
        return "No items match the filter criteria"
    }
  }

  if (!editedData.length) {
    return <div className="text-center py-4 text-gray-500">{getEmptyMessage()}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Store Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Item
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Qty
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Rarity
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Gold
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Silver
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Copper
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {editedData.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.storeName}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.item}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">
                <Input
                  type="text"
                  value={row.quantity}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                  className="h-8 w-16 text-sm"
                />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.rarity}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">
                <Input
                  type="text"
                  value={row.gold}
                  onChange={(e) => handlePriceChange(index, "gold", e.target.value)}
                  className="h-8 w-16 text-sm"
                />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 border">
                <Input
                  type="text"
                  value={row.silver}
                  onChange={(e) => handlePriceChange(index, "silver", e.target.value)}
                  className="h-8 w-16 text-sm"
                />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 border">
                <Input
                  type="text"
                  value={row.copper}
                  onChange={(e) => handlePriceChange(index, "copper", e.target.value)}
                  className="h-8 w-16 text-sm"
                />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 border">
                <Button variant="ghost" size="sm" onClick={() => handleDelete(index)} className="h-8 w-8 p-0">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-gray-500 text-right">{editedData.length} items</div>
    </div>
  )
}

