"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useMarketData } from "./market-data-provider"
import { RefreshCw, AlertCircle, Copy, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function DataLoader() {
  const { setMarketData, isLoading, setIsLoading, lastUpdated, setLastUpdated, setImportStats } = useMarketData()
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [localImportStats, setLocalImportStats] = useState<{
    liveRows: number
    liveNodes: number
    historicalRows: number
    historicalNodes: number
  } | null>(null)

  // Helper function to safely find the most recent timestamp in the data
  const findMostRecentTimestamp = (data: any[]) => {
    try {
      // Get all valid timestamps from the data
      const validTimestamps = data
        .map((item) => {
          try {
            // Use timestamp instead of date
            return item.timestamp
          } catch (e) {
            return null
          }
        })
        .filter((timestamp) => timestamp !== null)

      if (validTimestamps.length === 0) {
        return null
      }

      // Sort timestamps in descending order (most recent first)
      validTimestamps.sort((a, b) => {
        // Compare timestamps as strings
        return b.localeCompare(a)
      })

      // Return the most recent timestamp
      return validTimestamps[0]
    } catch (e) {
      console.error("Error finding most recent timestamp:", e)
      return null
    }
  }

  const fetchMarketData = async () => {
    setIsLoading(true)
    setError(null)
    setErrorDetails(null)
    setCopied(false)
    setLocalImportStats(null)
    setImportStats(null)

    try {
      // Fetch data from our API route that connects to Google Sheets
      const response = await fetch("/api/market-data")
      const responseData = await response.json()

      if (!response.ok) {
        // Handle API error responses
        setError(responseData.error || "Failed to fetch market data")
        setErrorDetails(responseData.details || "Please try again or report this issue")
        throw new Error(responseData.error || "Failed to fetch market data")
      }

      const data = responseData.data
      const stats = responseData.stats

      // Process the data - calculate total price for sorting if not already done
      const processedData = data.map((item: any) => ({
        ...item,
        totalPrice: item.totalPrice || item.gold * 10000 + item.silver * 100 + item.copper,
      }))

      setMarketData(processedData)

      // Find the most recent timestamp in the data
      const mostRecentTimestamp = findMostRecentTimestamp(processedData)
      if (mostRecentTimestamp) {
        setLastUpdated(mostRecentTimestamp)
      }

      // Set import statistics
      const importStats = {
        liveRows: stats.liveRows,
        liveNodes: stats.liveNodes,
        historicalRows: stats.historicalRows,
        historicalNodes: stats.historicalNodes,
      }

      setLocalImportStats(importStats)
      setImportStats(importStats)
    } catch (err: any) {
      console.error("Error fetching market data:", err)
      if (!error) {
        // Only set these if they weren't already set from the API response
        setError("Failed to load market data")
        setErrorDetails(err.message || "Please try again or report this issue")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const copyErrorToClipboard = () => {
    const errorText = `Error: ${error}
Details: ${errorDetails}
Timestamp: ${new Date().toISOString()}`
    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card className="bg-gray-800 border-gray-700 mb-8">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300">
              Please click "Load Market Data" (once) to pull the latest data from the guild's central node data
              repository.
            </p>
          </div>
          <Button onClick={fetchMarketData} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Load Market Data
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6 bg-red-900/50 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-gray-200">
              <div className="mb-2">{error}</div>
              {errorDetails && <div className="text-sm text-gray-300 mb-3">{errorDetails}</div>}
              <div className="flex items-center mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyErrorToClipboard}
                  className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy error details to report
                    </>
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {localImportStats && (
          <div className="mt-6 p-3 bg-green-900/20 border border-green-800/30 rounded-md">
            <p className="text-sm text-gray-200 flex items-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              <strong>Live Market Data:</strong>&nbsp;Imported {localImportStats.liveRows} rows from{" "}
              {localImportStats.liveNodes} {localImportStats.liveNodes === 1 ? "node" : "nodes"}
            </p>
            {localImportStats.historicalRows > 0 && (
              <p className="text-sm text-gray-200 flex items-center mt-1">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <strong>Historical Analysis:</strong>&nbsp;Using {localImportStats.historicalRows} rows from{" "}
                {localImportStats.historicalNodes} {localImportStats.historicalNodes === 1 ? "node" : "nodes"} for price
                averages
              </p>
            )}
          </div>
        )}

        {lastUpdated && !localImportStats && (
          <div className="mt-6 p-3 bg-gray-700/50 rounded-md">
            <p className="text-sm text-gray-300">
              <span className="font-medium">Last Updated:</span> {lastUpdated}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

