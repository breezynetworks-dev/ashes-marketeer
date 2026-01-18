"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { processImages } from "./actions"
import type { CSVRow } from "./components/data-table"
import { RATE_LIMIT_TIERS, NODES } from "./components/settings-dialog"
import { toTitleCase, cleanStoreName } from "./utils/text-formatting"
import { pushToGoogleSheets } from "./actions/sheets"

// Shadcn Imports
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Clock, FileImage, Info, Settings, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Component Imports
import { DataTable } from "./components/data-table"
import { ProcessTabs } from "./components/process-tabs"
import { SettingsDialog } from "./components/settings-dialog"
import { BatchStatusList } from "./components/batch-status-list"
import { PushResult } from "./components/push-result"

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to parse CSV text into structured data
const parseCSV = (csvText: string): CSVRow[] => {
  if (!csvText) return []

  const rows = csvText.split("\n").filter((line) => line.trim() !== "")

  return rows.map((row) => {
    const [storeName, item, quantity, rarity, gold, silver, copper] = row.split(",").map((cell) => cell?.trim() || "")
    return {
      storeName: cleanStoreName(toTitleCase(storeName)) || "",
      item: toTitleCase(item) || "",
      quantity: quantity || "",
      rarity: toTitleCase(rarity) || "",
      gold: gold || "0",
      silver: silver || "0",
      copper: copper || "0",
    }
  })
}

// Helper function to convert structured data back to CSV
const convertToCSV = (data: CSVRow[]): string => {
  if (!data.length) return ""

  const header = "Store Name,Item,Quantity,Rarity,Gold,Silver,Copper\n"
  const rows = data
    .map((row) => `${row.storeName},${row.item},${row.quantity},${row.rarity},${row.gold},${row.silver},${row.copper}`)
    .join("\n")

  return header + rows
}

export default function ImageToCSVConverter() {
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [error, setError] = useState("")
  const [csvData, setCsvData] = useState("")
  const [tableData, setTableData] = useState<CSVRow[]>([])
  const [cancelRequested, setCancelRequested] = useState(false)
  const [processingStats, setProcessingStats] = useState({
    totalImages: 0,
    processedImages: 0,
    currentBatch: 0,
    totalBatches: 0,
    startTime: 0,
    estimatedTimeRemaining: "",
    requestsInLastMinute: 0,
    lastRequestTime: 0,
  })
  const [cooldown, setCooldown] = useState({
    active: false,
    timeRemaining: 0,
    nextBatchAt: 0,
  })
  const [activeTab, setActiveTab] = useState("table")
  const [rateLimitTier, setRateLimitTier] = useState("tier1")
  const [selectedNode, setSelectedNode] = useState("none") // Default to None
  const [highAccuracyMode, setHighAccuracyMode] = useState(true) // Default to enabled
  const [shoppingList, setShoppingList] = useState("") // Add shopping list state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showNodeWarning, setShowNodeWarning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const requestTimesRef = useRef<number[]>([])
  const accumulatedDataRef = useRef<CSVRow[]>([])

  // Add these state variables
  const [isPushing, setIsPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  // Add a state to track if processing has been completed
  const [hasProcessedData, setHasProcessedData] = useState(false)

  // Add this to the state variables at the top of the component
  const [batchStatuses, setBatchStatuses] = useState<
    Array<{
      id: number
      status: "pending" | "processing" | "completed" | "error" | "retrying"
      error?: string
      retryCount?: number
      maxRetries?: number
    }>
  >([])

  // Add a ref to store batches for manual retries
  const batchesRef = useRef<File[][]>([])

  // Effect to update CSV data whenever tableData changes
  useEffect(() => {
    if (tableData.length > 0) {
      setCsvData(convertToCSV(tableData))
    }
  }, [tableData])

  // Update estimated time remaining
  useEffect(() => {
    if (isProcessing && processingStats.startTime > 0 && processingStats.processedImages > 0) {
      const updateEstimatedTime = () => {
        const elapsedTime = Date.now() - processingStats.startTime
        const imagesPerMs = processingStats.processedImages / elapsedTime
        const remainingImages = processingStats.totalImages - processingStats.processedImages

        if (imagesPerMs > 0 && remainingImages > 0) {
          const remainingTimeMs = remainingImages / imagesPerMs
          const remainingMinutes = Math.floor(remainingTimeMs / 60000)
          const remainingSeconds = Math.floor((remainingTimeMs % 60000) / 1000)

          setProcessingStats((prev) => ({
            ...prev,
            estimatedTimeRemaining: `${remainingMinutes}m ${remainingSeconds}s`,
          }))
        }
      }

      const timer = setInterval(updateEstimatedTime, 5000)
      return () => clearInterval(timer)
    }
  }, [isProcessing, processingStats.startTime, processingStats.processedImages, processingStats.totalImages])

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown.active && cooldown.timeRemaining > 0) {
      // Clear any existing timer
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
      }

      // Start a new timer that updates every second
      cooldownTimerRef.current = setInterval(() => {
        const now = Date.now()
        const remaining = Math.max(0, cooldown.nextBatchAt - now)

        setCooldown((prev) => ({
          ...prev,
          timeRemaining: remaining,
        }))

        // If countdown is complete, clear the interval
        if (remaining <= 0) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current)
          }
          setCooldown((prev) => ({
            ...prev,
            active: false,
          }))
        }
      }, 1000)

      // Cleanup function
      return () => {
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current)
        }
      }
    }
  }, [cooldown.active, cooldown.nextBatchAt])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.type === "image/jpeg" || file.type === "image/png",
      )

      // Limit to 150 files if needed
      const filesToAdd = selectedFiles.slice(0, 150)
      setFiles((prev) => {
        const combined = [...prev, ...filesToAdd]
        return combined.slice(0, 150) // Ensure we don't exceed 150 files
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "image/jpeg" || file.type === "image/png",
      )

      setFiles((prev) => {
        const combined = [...prev, ...droppedFiles]
        return combined.slice(0, 150) // Limit to 150 files
      })
    }
  }

  const resetUI = () => {
    setIsProcessing(false)
    setCancelRequested(false)
    setCooldown({
      active: false,
      timeRemaining: 0,
      nextBatchAt: 0,
    })
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current)
    }
    setProcessingStats({
      totalImages: 0,
      processedImages: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: 0,
      estimatedTimeRemaining: "",
      requestsInLastMinute: 0,
      lastRequestTime: 0,
    })
    requestTimesRef.current = []
    setBatchStatuses([])
    // Don't reset accumulatedDataRef here to keep the data after processing is complete
  }

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result?.toString()
        resolve(base64 || "")
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const result = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  }

  const handleCancel = () => {
    setCancelRequested(true)
    setProgressText("Cancelling...")
    setCooldown({
      active: false,
      timeRemaining: 0,
      nextBatchAt: 0,
    })
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current)
    }
  }

  // Format time in seconds to mm:ss format
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.ceil(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Check if we need to wait based on rate limits
  const shouldWaitForRateLimit = (): boolean => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Filter request times to only include those in the last minute
    const recentRequests = requestTimesRef.current.filter((time) => time > oneMinuteAgo)

    // Get the rate limit for the current tier
    const tier = RATE_LIMIT_TIERS[rateLimitTier]
    const maxRequestsPerMinute = tier.requestsPerMinute

    // If we've made fewer requests than our limit, no need to wait
    return recentRequests.length >= maxRequestsPerMinute
  }

  // Calculate how long to wait based on rate limits
  const calculateWaitTime = (): number => {
    const now = Date.now()
    const tier = RATE_LIMIT_TIERS[rateLimitTier]

    // If we don't need to wait, return 0
    if (!shouldWaitForRateLimit()) {
      return 0
    }

    // Sort request times in ascending order
    const sortedTimes = [...requestTimesRef.current].sort((a, b) => a - b)

    // Calculate when the oldest request will "expire" from our minute window
    // This is when we can make a new request
    const oldestRelevantRequest = sortedTimes[sortedTimes.length - tier.requestsPerMinute]

    // Wait until that request is more than a minute old
    const waitUntil = oldestRelevantRequest + 60000
    const waitTime = Math.max(0, waitUntil - now)

    return waitTime
  }

  // Find the updatePreview function again and modify it to include logging:

  // Update the preview with new data
  const updatePreview = (newCsvData: string) => {
    // Parse the new CSV data
    const newRows = parseCSV(newCsvData)

    // Filter out incomplete records
    const validRows = newRows.filter((row) => {
      // Check if any required field is empty
      if (!row.storeName || !row.item || !row.quantity || !row.rarity) {
        console.log("Filtering out incomplete record:", row)
        return false
      }

      // Check if all currency values are "0" (which is invalid)
      if (row.gold === "0" && row.silver === "0" && row.copper === "0") {
        console.log("Filtering out record with all zero currency:", row)
        return false
      }

      // Otherwise, the record is valid
      return true
    })

    console.log(`Filtered ${newRows.length - validRows.length} incomplete records out of ${newRows.length}`)

    // Add the valid rows to the accumulated data
    accumulatedDataRef.current = [...accumulatedDataRef.current, ...validRows]

    // Update the main tableData state
    setTableData([...accumulatedDataRef.current])
  }

  const handleProcess = async () => {
    if (!files.length) {
      setError("Please upload at least one image.")
      return
    }

    // Check if a node is selected and show warning if not
    if (selectedNode === "none") {
      setShowNodeWarning(true)
      // Return early if the user wants to select a node first
      return
    }

    // Reset the warning state
    setShowNodeWarning(false)

    setIsProcessing(true)
    setCancelRequested(false)
    setError("")
    setCsvData("")
    setTableData([])
    setProgress(0)
    setProgressText("")
    requestTimesRef.current = []
    accumulatedDataRef.current = []
    setHasProcessedData(false)

    // Set batch size based on high accuracy mode
    const BATCH_SIZE = highAccuracyMode ? 1 : 3
    const batches = chunkArray(files, BATCH_SIZE)
    batchesRef.current = batches
    const totalBatches = batches.length
    const totalImages = files.length

    // Initialize processing stats
    setProcessingStats({
      totalImages,
      processedImages: 0,
      currentBatch: 0,
      totalBatches,
      startTime: Date.now(),
      estimatedTimeRemaining: "Calculating...",
      requestsInLastMinute: 0,
      lastRequestTime: 0,
    })

    // Initialize batch statuses
    const initialBatchStatuses = Array.from({ length: totalBatches }, (_, index) => ({
      id: index + 1,
      status: "pending" as const,
    }))
    setBatchStatuses(initialBatchStatuses)

    for (let i = 0; i < totalBatches; i++) {
      if (cancelRequested) {
        setProgressText("Cancelled.")
        resetUI()
        return
      }

      try {
        // Check if we need to wait for rate limit
        if (i > 0) {
          const shouldWait = shouldWaitForRateLimit()

          if (shouldWait) {
            const waitTime = calculateWaitTime()

            if (waitTime > 0) {
              const nextBatchTime = Date.now() + waitTime

              // Set cooldown state
              setCooldown({
                active: true,
                timeRemaining: waitTime,
                nextBatchAt: nextBatchTime,
              })

              const tier = RATE_LIMIT_TIERS[rateLimitTier]
              setProgressText(
                `Rate limit reached (${tier.requestsPerMinute}/min). Next batch in ${formatTime(waitTime)}`,
              )

              // Wait for the cooldown period
              await delay(waitTime)

              // Reset cooldown state
              setCooldown({
                active: false,
                timeRemaining: 0,
                nextBatchAt: 0,
              })

              if (cancelRequested) {
                setProgressText("Cancelled during cooldown.")
                resetUI()
                return
              }
            }
          }
        }

        // Convert files to base64
        const base64Images = await Promise.all(batches[i].map(toBase64))

        setProgressText(`Processing batch ${i + 1} of ${totalBatches}...`)

        // Before processing a batch:
        setBatchStatuses((prev) => {
          const updated = [...prev]
          if (updated[i]) {
            updated[i].status = "processing"
          }
          return updated
        })

        // Use server action to process this batch
        const result = await processImages(base64Images)

        // Record this request time
        const now = Date.now()
        requestTimesRef.current.push(now)

        // Update processing stats
        setProcessingStats((prev) => ({
          ...prev,
          lastRequestTime: now,
        }))

        if (!result.success) {
          throw new Error(result.error || "Unknown error")
        }

        // Add null check for csv property
        if (result.csv) {
          // Update the preview with new data - this is the key part for live updates
          updatePreview(result.csv)
        }

        const percent = Math.round(((i + 1) / totalBatches) * 100)
        setProgress(percent)

        // Update processing stats
        const batchSize = batches[i].length
        setProcessingStats((prev) => ({
          ...prev,
          processedImages: prev.processedImages + batchSize,
          currentBatch: i + 1,
        }))

        // After successful processing:
        setBatchStatuses((prev) => {
          const updated = [...prev]
          if (updated[i]) {
            updated[i].status = "completed"
          }
          return updated
        })

        setProgressText(`Completed batch ${i + 1} of ${totalBatches} (${percent}%)`)
      } catch (err: any) {
        console.error(`Batch ${i + 1} error:`, err)

        // Mark the batch as error
        setBatchStatuses((prev) => {
          const updated = [...prev]
          if (updated[i]) {
            updated[i].status = "error"
            updated[i].error = err.message
          }
          return updated
        })

        // Stop processing and reset UI
        setError(`Batch ${i + 1} failed: ${err.message}`)
        resetUI()
        return // Exit the function immediately
      }
    }

    // Update the handleProcess function to add this at the end, right before resetUI()
    if (!cancelRequested) {
      setProgressText("Done!")

      // Automatically switch to the process tab
      setActiveTab("process")

      // Mark that we have processed data
      setHasProcessedData(true)
    }

    setIsProcessing(false)
  }

  // Function to proceed with processing even without a node selected
  const handleProceedWithoutNode = () => {
    setShowNodeWarning(false)
    setIsProcessing(true)
    // Continue with the processing logic
    const processAsync = async () => {
      setCancelRequested(false)
      setError("")
      setCsvData("")
      setTableData([])
      setProgress(0)
      setProgressText("")
      requestTimesRef.current = []
      accumulatedDataRef.current = []
      setHasProcessedData(false)

      // Set batch size based on high accuracy mode
      const BATCH_SIZE = highAccuracyMode ? 1 : 3
      const batches = chunkArray(files, BATCH_SIZE)
      const totalBatches = batches.length
      const totalImages = files.length

      // Initialize processing stats
      setProcessingStats({
        totalImages,
        processedImages: 0,
        currentBatch: 0,
        totalBatches,
        startTime: Date.now(),
        estimatedTimeRemaining: "Calculating...",
        requestsInLastMinute: 0,
        lastRequestTime: 0,
      })

      // Maximum number of retry attempts per batch
      const MAX_RETRIES = 3

      // Initialize batch statuses
      const initialBatchStatuses = Array.from({ length: totalBatches }, (_, index) => ({
        id: index + 1,
        status: "pending" as const,
      }))
      setBatchStatuses(initialBatchStatuses)

      for (let i = 0; i < totalBatches; i++) {
        if (cancelRequested) {
          setProgressText("Cancelled.")
          resetUI()
          return
        }

        try {
          // Check if we need to wait for rate limit (only after the first batch)
          if (i > 0) {
            const shouldWait = shouldWaitForRateLimit()

            if (shouldWait) {
              const waitTime = calculateWaitTime()

              if (waitTime > 0) {
                const nextBatchTime = Date.now() + waitTime

                // Set cooldown state
                setCooldown({
                  active: true,
                  timeRemaining: waitTime,
                  nextBatchAt: nextBatchTime,
                })

                const tier = RATE_LIMIT_TIERS[rateLimitTier]
                setProgressText(
                  `Rate limit reached (${tier.requestsPerMinute}/min). Next batch in ${formatTime(waitTime)}`,
                )

                // Wait for the cooldown period
                await delay(waitTime)

                // Reset cooldown state
                setCooldown({
                  active: false,
                  timeRemaining: 0,
                  nextBatchAt: 0,
                })

                if (cancelRequested) {
                  setProgressText("Cancelled during cooldown.")
                  resetUI()
                  return
                }
              }
            }
          }

          // Convert files to base64
          const base64Images = await Promise.all(batches[i].map(toBase64))

          setProgressText(`Processing batch ${i + 1} of ${totalBatches}...`)

          // Before processing a batch:
          setBatchStatuses((prev) => {
            const updated = [...prev]
            if (updated[i]) {
              updated[i].status = "processing"
            }
            return updated
          })

          // Use server action to process this batch
          const result = await processImages(base64Images)

          // Record this request time
          const now = Date.now()
          requestTimesRef.current.push(now)

          // Update processing stats
          setProcessingStats((prev) => ({
            ...prev,
            lastRequestTime: now,
          }))

          if (!result.success) {
            throw new Error(result.error || "Unknown error")
          }

          // Add null check for csv property
          if (result.csv) {
            // Update the preview with new data - this is the key part for live updates
            updatePreview(result.csv)
          }

          const percent = Math.round(((i + 1) / totalBatches) * 100)
          setProgress(percent)

          // Update processing stats
          const batchSize = batches[i].length
          setProcessingStats((prev) => ({
            ...prev,
            processedImages: prev.processedImages + batchSize,
            currentBatch: i + 1,
          }))

          // If we get here, the batch was processed successfully
          setBatchStatuses((prev) => {
            const updated = [...prev]
            if (updated[i]) {
              updated[i].status = "completed"
            }
            return updated
          })

          setProgressText(`Completed batch ${i + 1} of ${totalBatches} (${percent}%)`)
        } catch (err: any) {
          console.error(`Batch ${i + 1} error:`, err)

          // Mark the batch as error
          setBatchStatuses((prev) => {
            const updated = [...prev]
            if (updated[i]) {
              updated[i].status = "error"
              updated[i].error = err.message
            }
            return updated
          })

          // Stop processing and reset UI
          setError(`Batch ${i + 1} failed: ${err.message}`)
          resetUI()
          return // Exit the function immediately
        }
      }

      if (!cancelRequested) {
        setProgressText("Done! Failed batches can be retried manually.")
        setActiveTab("process")
        setHasProcessedData(true)
      }

      resetUI()
    }

    processAsync()
  }

  // Function to open settings dialog
  const handleOpenSettings = () => {
    setShowNodeWarning(false)
    setShowSettingsDialog(true)
  }

  // Fix the handlePushToSheets function with proper syntax
  const handlePushToSheets = async () => {
    // Always use tableData since it contains the most up-to-date information
    if (!tableData.length) {
      setError("No data to push to Google Sheets.")
      return
    }

    // Check if a node is selected
    if (selectedNode === "none") {
      setError("Please select a node in Settings before exporting to Google Sheets.")
      return
    }

    setIsPushing(true)
    setPushResult(null)

    try {
      // Get the Google Sheet URL for the selected node
      const sheetUrl = NODES[selectedNode].sheetUrl
      const nodeName = NODES[selectedNode].name

      // Generate CSV for Google Sheets
      const result = await pushToGoogleSheets(sheetUrl, tableData, nodeName)

      setPushResult(result)

      if (!result.success) {
        setError(result.error || "Failed to generate CSV for Google Sheets")
      } else {
        // If the result contains csvContent, it means we're in fallback mode (no Google auth)
        if (result.csvContent) {
          // Create a blob and URL for the CSV file
          const blob = new Blob([result.csvContent], { type: "text/csv" })
          const csvUrl = URL.createObjectURL(blob)

          // Create a download link for the CSV
          const link = document.createElement("a")
          link.href = csvUrl
          link.download = `${result.dateStr || "data"}.csv`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    } catch (error: any) {
      console.error("Push to sheets error:", error)
      setPushResult({
        success: false,
        error: error.message || "An unexpected error occurred",
      })
      setError(error.message || "Failed to push data to Google Sheets")
    } finally {
      setIsPushing(false)
    }
  }

  const clearFiles = () => {
    setFiles([])
    setCsvData("")
    setTableData([])
    setError("")
    accumulatedDataRef.current = []
    setHasProcessedData(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Remove the alert sections from the main page

  const handleManualRetry = async (batchNumber: number) => {
    // Find the batch in batchesRef.current using the batchId
    const batchIndex = batchNumber - 1
    const batchToRetry = batchesRef.current[batchIndex]

    if (!batchToRetry) {
      console.error(`Batch with ID ${batchNumber} not found.`)
      return
    }

    // Set processing state
    setIsProcessing(true)
    setError("")

    // Update the status of the batch to "retrying"
    setBatchStatuses((prev) => {
      const updated = [...prev]
      if (updated[batchIndex]) {
        updated[batchIndex].status = "retrying"
        updated[batchIndex].retryCount = (updated[batchIndex].retryCount || 0) + 1
      }
      return updated
    })

    try {
      // Convert files to base64
      const base64Images = await Promise.all(batchToRetry.map(toBase64))

      setProgressText(`Retrying batch ${batchNumber}...`)

      // Use server action to process this batch
      const result = await processImages(base64Images)

      // Record this request time
      const now = Date.now()
      requestTimesRef.current.push(now)

      if (!result.success) {
        throw new Error(result.error || "Unknown error")
      }

      // Add null check for csv property
      if (result.csv) {
        // Update the preview with new data
        updatePreview(result.csv)
      }

      // After successful processing:
      setBatchStatuses((prev) => {
        const updated = [...prev]
        if (updated[batchIndex]) {
          updated[batchIndex].status = "completed"
        }
        return updated
      })

      setProgressText(`Batch ${batchNumber} retried and completed successfully.`)

      // Continue with the next batches
      await continueProcessingFromBatch(batchIndex + 1)
    } catch (err: any) {
      console.error(`Batch ${batchNumber} retry error:`, err)

      // Mark the batch as error
      setBatchStatuses((prev) => {
        const updated = [...prev]
        if (updated[batchIndex]) {
          updated[batchIndex].status = "error"
          updated[batchIndex].error = err.message
        }
        return updated
      })

      setError(`Batch ${batchNumber} retry failed: ${err.message}`)
      setIsProcessing(false)
    }
  }

  // Add a new function to continue processing from a specific batch
  const continueProcessingFromBatch = async (startBatchIndex: number) => {
    const totalBatches = batchesRef.current.length

    for (let i = startBatchIndex; i < totalBatches; i++) {
      if (cancelRequested) {
        setProgressText("Cancelled.")
        resetUI()
        return
      }

      try {
        // Check if we need to wait for rate limit
        if (i > startBatchIndex) {
          const shouldWait = shouldWaitForRateLimit()

          if (shouldWait) {
            const waitTime = calculateWaitTime()

            if (waitTime > 0) {
              const nextBatchTime = Date.now() + waitTime

              // Set cooldown state
              setCooldown({
                active: true,
                timeRemaining: waitTime,
                nextBatchAt: nextBatchTime,
              })

              const tier = RATE_LIMIT_TIERS[rateLimitTier]
              setProgressText(
                `Rate limit reached (${tier.requestsPerMinute}/min). Next batch in ${formatTime(waitTime)}`,
              )

              // Wait for the cooldown period
              await delay(waitTime)

              // Reset cooldown state
              setCooldown({
                active: false,
                timeRemaining: 0,
                nextBatchAt: nextBatchTime,
              })

              if (cancelRequested) {
                setProgressText("Cancelled during cooldown.")
                resetUI()
                return
              }
            }
          }
        }

        // Convert files to base64
        const base64Images = await Promise.all(batchesRef.current[i].map(toBase64))

        setProgressText(`Processing batch ${i + 1} of ${totalBatches}...`)

        // Before processing a batch:
        setBatchStatuses((prev) => {
          const updated = [...prev]
          if (updated[i]) {
            updated[i].status = "processing"
          }
          return updated
        })

        // Use server action to process this batch
        const result = await processImages(base64Images)

        // Record this request time
        const now = Date.now()
        requestTimesRef.current.push(now)

        // Update processing stats
        setProcessingStats((prev) => ({
          ...prev,
          lastRequestTime: now,
        }))

        if (!result.success) {
          throw new Error(result.error || "Unknown error")
        }

        // Add null check for csv property
        if (result.csv) {
          // Update the preview with new data
          updatePreview(result.csv)
        }

        const percent = Math.round(((i + 1) / totalBatches) * 100)
        setProgress(percent)

        // Update processing stats
        const batchSize = batchesRef.current[i].length
        setProcessingStats((prev) => ({
          ...prev,
          processedImages: prev.processedImages + batchSize,
          currentBatch: i + 1,
        }))

        // After successful processing:
        setBatchStatuses((prev) => {
          const updated = [...prev]
          if (updated[i]) {
            updated[i].status = "completed"
          }
          return updated
        })

        setProgressText(`Completed batch ${i + 1} of ${totalBatches} (${percent}%)`)
      } catch (err: any) {
        console.error(`Batch ${i + 1} error:`, err)

        // Mark the batch as error
        setBatchStatuses((prev) => {
          const updated = [...prev]
          if (updated[i]) {
            updated[i].status = "error"
            updated[i].error = err.message
          }
          return updated
        })

        // Stop processing and reset UI
        setError(`Batch ${i + 1} failed: ${err.message}`)
        setIsProcessing(false)
        return // Exit the function immediately
      }
    }

    // All batches completed successfully
    if (!cancelRequested) {
      setProgressText("Done!")
      setActiveTab("process")
      setHasProcessedData(true)
    }

    setIsProcessing(false)
  }

  // This is the missing part - the closing of the component function and the return statement
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Show push result if available */}
      {pushResult && (
        <div className="w-full max-w-4xl mx-auto mb-4">
          <PushResult result={pushResult} />
        </div>
      )}

      <Card className="w-full max-w-4xl mx-auto relative">
        <SettingsDialog
          selectedTier={rateLimitTier}
          onTierChange={setRateLimitTier}
          selectedNode={selectedNode}
          onNodeChange={setSelectedNode}
          highAccuracyMode={highAccuracyMode}
          onHighAccuracyModeChange={setHighAccuracyMode}
          shoppingList={shoppingList}
          onShoppingListChange={setShoppingList}
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
        />

        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">The Night Shift - Market Uploader</CardTitle>
              <CardDescription className="py-2">
                Upload your screenshots and export to Google Sheets
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {RATE_LIMIT_TIERS[rateLimitTier].name} ({RATE_LIMIT_TIERS[rateLimitTier].requestsPerMinute}/min)
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Node: {NODES[selectedNode].name}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {highAccuracyMode ? "High Accuracy: On" : "High Accuracy: Off"}
                  </span>
                </div>
              </CardDescription>
            </div>
            {files.length > 0 && (
              <Badge variant="outline" className="text-sm">
                {files.length} {files.length === 1 ? "file" : "files"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Node Warning Alert */}
          {showNodeWarning && (
            <Alert variant="warning" className="mb-6 bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  No node is selected. You can still process images, but you won't be able to push to Google Sheets.
                </span>
                <div className="flex space-x-2 ml-4">
                  <Button variant="outline" size="sm" onClick={handleOpenSettings} className="text-xs">
                    <Settings className="h-3 w-3 mr-1" /> Select Node
                  </Button>
                  <Button variant="default" size="sm" onClick={handleProceedWithoutNode} className="text-xs">
                    Proceed Anyway
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="images"
              multiple
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
              ref={fileInputRef}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <FileImage className="h-12 w-12 text-gray-400" />
              <div className="text-sm text-gray-500">
                <label htmlFor="images" className="cursor-pointer text-primary hover:underline">
                  Click to upload
                </label>
                {" or drag and drop"}
              </div>
              <div className="text-xs text-gray-400">PNG, JPG up to 10MB each (max 150 files)</div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">Selected Files ({files.length}/150)</h3>
                <Button variant="ghost" size="sm" onClick={clearFiles} disabled={isProcessing}>
                  <X className="h-4 w-4 mr-1" /> Clear All
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                <ul className="text-sm">
                  {files.map((file, index) => (
                    <li key={index} className="py-1 px-2 hover:bg-gray-50 rounded flex justify-between">
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-400 text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="mb-6 space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progressText}</span>
                {processingStats.estimatedTimeRemaining && !cooldown.active && (
                  <span>Est. remaining: {processingStats.estimatedTimeRemaining}</span>
                )}
              </div>

              {cooldown.active && cooldown.timeRemaining > 0 && (
                <div className="flex items-center justify-center space-x-2 bg-amber-50 p-2 rounded-md border border-amber-200 mt-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-700">
                    Rate limit cooldown: {formatTime(cooldown.timeRemaining)} remaining
                  </span>
                </div>
              )}

              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>
                  Images: {processingStats.processedImages}/{processingStats.totalImages}
                </span>
                <span>
                  Batches: {processingStats.currentBatch}/{processingStats.totalBatches}
                </span>
              </div>

              {/* Add the BatchStatusList component here */}
              {batchStatuses.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Batch Status</h4>
                  <BatchStatusList batches={batchStatuses} onRetry={handleManualRetry} />
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Show the preview during processing and after completion */}
          {(tableData.length > 0 || (isProcessing && accumulatedDataRef.current.length > 0)) && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">Preview {isProcessing ? "(Live)" : ""}</h3>
              </div>
              <Tabs defaultValue="table" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-2 flex justify-between bg-green-100">
                  <div className="flex">
                    <TabsTrigger value="table">Table View</TabsTrigger>
                    <TabsTrigger value="raw">Raw CSV</TabsTrigger>
                    <TabsTrigger value="process">Process</TabsTrigger>
                  </div>
                </TabsList>
                <TabsContent value="table" className="border rounded-md p-2">
                  <div className="max-h-96 overflow-auto">
                    <DataTable data={isProcessing ? accumulatedDataRef.current : tableData} />
                  </div>
                  <div className="mt-2 text-xs text-gray-500 text-right">
                    {isProcessing ? accumulatedDataRef.current.length : tableData.length} rows
                  </div>
                </TabsContent>
                <TabsContent value="raw" className="border rounded-md p-4 max-h-60 overflow-auto">
                  <pre className="text-sm whitespace-pre-wrap">{csvData}</pre>
                </TabsContent>
                <TabsContent value="process" className="border rounded-md p-2">
                  <div className="max-h-96 overflow-auto">
                    <ProcessTabs
                      data={tableData}
                      onDataChange={setTableData}
                      isPushing={isPushing}
                      isProcessing={isProcessing}
                      onPushToSheets={handlePushToSheets}
                      shoppingList={shoppingList}
                    />
                  </div>

                  {/* Action buttons moved outside the table block but still inside the Process tab */}
                  {activeTab === "process" && tableData.length > 0 && (
                    <div className="flex justify-end space-x-2 mt-4 p-6 pt-0">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mr-auto">
                            <Info className="h-5 w-5 text-gray-500" />
                            <span className="sr-only">Tab Information</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" side="bottom">
                          <div className="space-y-2">
                            <h4 className="font-medium">Tab Explanations</h4>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                              <li>
                                <strong>4 Gold Or More</strong>: Shows items with a gold value of 4 or higher.
                              </li>
                              <li>
                                <strong>-Rarity, +Price</strong>: Shows Common, Uncommon, Rare, or Heroic items with a
                                gold value of 1 or higher.
                              </li>
                              <li>
                                <strong>+Rarity, -Price</strong>: Shows Epic or Legendary items with a total value of
                                less than 1 gold.
                              </li>
                              <li>
                                <strong>Epic Rarities</strong>: Shows all items with Epic rarity regardless of price.
                              </li>
                              <li>
                                <strong>Legendaries</strong>: Shows all items with Legendary rarity regardless of price.
                              </li>
                              <li>
                                <strong>Shopping List</strong>: Shows items matching your shopping list entries.
                              </li>
                            </ul>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button
                        variant="outline"
                        onClick={handlePushToSheets}
                        disabled={isPushing || isProcessing || selectedNode === "none"}
                      >
                        {isPushing ? (
                          <>
                            <span className="mr-2">Pushing to Sheets...</span>
                            <span className="animate-spin">⏳</span>
                          </>
                        ) : (
                          <>
                            <span className="mr-2">Push to Sheets</span>
                            <span>📊</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          {!hasProcessedData && (
            <Button onClick={handleProcess} disabled={isProcessing || files.length === 0}>
              <Upload className="h-4 w-4 mr-2" /> Process Images
            </Button>
          )}
          {isProcessing && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelRequested}>
              Cancel
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

