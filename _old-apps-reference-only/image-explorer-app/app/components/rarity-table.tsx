"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CSVRow } from "./data-table"

interface RarityTableProps {
  data: CSVRow[]
  rarityFilter: string
}

export function RarityTable({ data, rarityFilter }: RarityTableProps) {
  // Filter data by rarity (case-insensitive)
  const filteredData = data.filter((row) => row.rarity.toLowerCase() === rarityFilter.toLowerCase())

  if (!filteredData.length) {
    return <div className="text-center py-4 text-gray-500">No items with {rarityFilter} rarity found</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Store Name</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Gold</TableHead>
            <TableHead>Silver</TableHead>
            <TableHead>Copper</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((row, index) => (
            <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <TableCell className="font-medium">{row.storeName}</TableCell>
              <TableCell>{row.item}</TableCell>
              <TableCell>{row.quantity}</TableCell>
              <TableCell>{row.gold}</TableCell>
              <TableCell>{row.silver}</TableCell>
              <TableCell>{row.copper}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-2 text-xs text-gray-500 text-right">
        {filteredData.length} {rarityFilter} items
      </div>
    </div>
  )
}

