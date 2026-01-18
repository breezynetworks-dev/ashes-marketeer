"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface CSVPreviewProps {
  csvData: string
  maxRows?: number
}

export function CSVPreview({ csvData, maxRows = 10 }: CSVPreviewProps) {
  const [page, setPage] = useState(0)

  if (!csvData) {
    return <div className="text-center py-4 text-gray-500">No data to preview</div>
  }

  // Simple CSV parsing
  const rows = csvData.split("\n").filter((row) => row.trim() !== "")
  const parsedRows = rows.map((row) => row.split(","))

  // Get headers from the first row
  const headers = parsedRows.length > 0 ? parsedRows[0] : []

  // Paginate the data rows (skip the header row)
  const totalPages = Math.ceil((parsedRows.length - 1) / maxRows)
  const startRow = page * maxRows + 1 // +1 to skip header
  const endRow = Math.min(startRow + maxRows, parsedRows.length)
  const currentRows = parsedRows.slice(startRow, endRow)

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, index) => (
                <TableHead key={index}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {startRow} to {endRow - 1} of {parsedRows.length - 1} rows
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

