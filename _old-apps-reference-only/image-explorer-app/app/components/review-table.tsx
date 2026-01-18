"use client"

import { useState, useEffect } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CSVRow } from "./data-table"

interface ReviewTableProps {
  data: CSVRow[]
  onDataChange: (newData: CSVRow[]) => void
  onChangeDetected?: (hasChanges: boolean) => void
}

export function ReviewTable({ data, onDataChange, onChangeDetected }: ReviewTableProps) {
  // Local state for edited data (not immediately passed to parent)
  const [editedData, setEditedData] = useState<CSVRow[]>([])
  const [originalData, setOriginalData] = useState<CSVRow[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    // Log the incoming data to see what we're working with
    console.log("ReviewTable received data:", data)

    if (!data || data.length === 0) {
      console.log("No data received in ReviewTable")
      return
    }

    // Filter rows with gold >= 5 (changed from > 0)
    const filtered = data.filter((row) => {
      // Trim any whitespace and ensure we're properly parsing the gold value
      const goldStr = (row.gold || "").toString().trim()
      const goldValue = Number.parseInt(goldStr, 10)

      // Log each row's gold value for debugging
      console.log(`Item: ${row.item}, Gold string: "${goldStr}", Parsed gold: ${goldValue}, Is >= 5: ${goldValue >= 5}`)

      return !isNaN(goldValue) && goldValue >= 5
    })

    console.log("Filtered items with gold >= 5:", filtered.length)

    setEditedData(filtered)
    setOriginalData(JSON.parse(JSON.stringify(filtered))) // Deep copy for comparison
  }, [data])

  // Check for changes whenever editedData is updated
  useEffect(() => {
    if (editedData.length !== originalData.length) {
      setHasChanges(true)
      onChangeDetected && onChangeDetected(true)
      return
    }

    // Compare each row to detect changes
    const changed = editedData.some((row, index) => {
      const origRow = originalData[index]
      return (
        row.gold !== origRow.gold ||
        row.silver !== origRow.silver ||
        row.copper !== origRow.copper ||
        row.quantity !== origRow.quantity
      )
    })

    setHasChanges(changed)
    onChangeDetected && onChangeDetected(changed)
  }, [editedData, originalData, onChangeDetected])

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

  if (!editedData.length) {
    return <div className="text-center py-4 text-gray-500">No items with gold value of 5 or more</div>
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
    </div>
  )
}

