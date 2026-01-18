"use client"

import { AlertCircle, CheckCircle, Clock, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export type BatchStatus = "pending" | "processing" | "completed" | "error" | "retrying"

interface BatchStatusItemProps {
  batchNumber: number
  status: BatchStatus
  error?: string
  retryCount?: number
  maxRetries?: number
  onRetry?: (batchNumber: number) => void
}

export function BatchStatusItem({
  batchNumber,
  status,
  error,
  retryCount = 0,
  maxRetries = 3,
  onRetry,
}: BatchStatusItemProps) {
  return (
    <div className="flex items-center space-x-2 p-2 border rounded-md bg-white">
      <div className="flex-shrink-0">
        {status === "pending" && <Clock className="h-4 w-4 text-gray-400" />}
        {status === "processing" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
        {status === "completed" && <CheckCircle className="h-4 w-4 text-green-500" />}
        {status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
        {status === "retrying" && <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />}
      </div>

      <div className="flex-grow min-w-0">
        <div className="flex items-center">
          <span className="text-sm font-medium truncate">Batch {batchNumber}</span>
          {status === "retrying" && retryCount > 0 && (
            <span className="ml-2 text-xs text-amber-500">
              Retry {retryCount}/{maxRetries}
            </span>
          )}
        </div>
        {status === "error" && error && <span className="text-xs text-red-500 block truncate">{error}</span>}
      </div>

      {status === "error" && onRetry && (
        <Button
          variant="default"
          size="sm"
          className="flex-shrink-0 h-7 px-2 bg-amber-500 hover:bg-amber-600"
          onClick={() => onRetry(batchNumber)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Resume
        </Button>
      )}
    </div>
  )
}

interface BatchStatusListProps {
  batches: Array<{
    id: number
    status: BatchStatus
    error?: string
    retryCount?: number
    maxRetries?: number
  }>
  onRetry?: (batchNumber: number) => void
}

export function BatchStatusList({ batches, onRetry }: BatchStatusListProps) {
  if (!batches.length) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2">
      {batches.map((batch) => (
        <BatchStatusItem
          key={batch.id}
          batchNumber={batch.id}
          status={batch.status}
          error={batch.error}
          retryCount={batch.retryCount}
          maxRetries={batch.maxRetries}
          onRetry={onRetry}
        />
      ))}
    </div>
  )
}

