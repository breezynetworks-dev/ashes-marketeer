"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, Zap, Package, AlertCircle, CheckCircle2, SkipForward, XCircle, ArrowRight, FileImage, Sparkles, Brain, User, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { AI_MODELS, DEFAULT_MODEL, type AIModel, getModelConfig } from "@/lib/ai-extraction"

const NODES = ["New Aela", "Halcyon", "Joeva", "Miraleth", "Winstead"] as const
type NodeType = typeof NODES[number]

type UploadState = "idle" | "uploading" | "checking" | "processing" | "error" | "complete"

interface FileMetadata {
  filename: string
  size: number
  hash: string
}

interface ThoughtMessage {
  id: number
  type: "info" | "success" | "skip" | "error" | "retry"
  message: string
}

interface ProgressData {
  tokens: number
  batchCurrent: number
  batchTotal: number
  itemsExtracted: number
  duplicatesSkipped: number
}

export default function UploadPage() {
  const [state, setState] = useState<UploadState>("idle")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<FileMetadata[]>([])
  const [batchId, setBatchId] = useState<string | null>(null)
  const [thoughts, setThoughts] = useState<ThoughtMessage[]>([])
  const [progressData, setProgressData] = useState<ProgressData>({
    tokens: 0,
    batchCurrent: 0,
    batchTotal: 0,
    itemsExtracted: 0,
    duplicatesSkipped: 0,
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorFilename, setErrorFilename] = useState<string | null>(null)
  const [totalFilesSelected, setTotalFilesSelected] = useState(0)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<string>("")
  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL)
  const [characterName, setCharacterName] = useState<string>("")
  const [selectedNode, setSelectedNode] = useState<NodeType | "">("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const thoughtIdCounter = useRef(0)

  const progress = progressData.batchTotal > 0
    ? (progressData.batchCurrent / progressData.batchTotal) * 100
    : 0

  const canUpload = characterName.trim() !== '' && selectedNode !== ''

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  // Load character name and node from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('uploadCharacterName')
    const savedNode = localStorage.getItem('uploadNode')
    if (savedName) setCharacterName(savedName)
    if (savedNode && NODES.includes(savedNode as NodeType)) {
      setSelectedNode(savedNode as NodeType)
    }
  }, [])

  // Persist character name to localStorage
  useEffect(() => {
    if (characterName) {
      localStorage.setItem('uploadCharacterName', characterName)
    }
  }, [characterName])

  // Persist node to localStorage
  useEffect(() => {
    if (selectedNode) {
      localStorage.setItem('uploadNode', selectedNode)
    }
  }, [selectedNode])

  // Fetch selected AI model on mount
  useEffect(() => {
    async function fetchModel() {
      try {
        const response = await fetch('/api/settings/ai_extraction_model')
        if (response.ok) {
          const data = await response.json()
          if (data.value?.model) {
            setSelectedModel(data.value.model as AIModel)
          }
        }
      } catch (error) {
        console.error('Failed to fetch AI model setting:', error)
      }
    }
    fetchModel()
  }, [])

  const addThought = (type: ThoughtMessage["type"], message: string) => {
    const id = ++thoughtIdCounter.current // Capture ID before state update callback
    setThoughts(prev => [...prev, {
      id,
      type,
      message
    }])
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    // Validate required fields
    if (!characterName.trim()) {
      toast.error('Please enter your character name')
      return
    }
    if (!selectedNode) {
      toast.error('Please select a node')
      return
    }

    setState("uploading")
    setTotalFilesSelected(files.length)
    setConnectionStatus(`Uploading ${files.length} file${files.length !== 1 ? 's' : ''}`)

    try {
      // Step 1: Upload files to /api/upload/files
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const uploadResponse = await fetch('/api/upload/files', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        toast.error(error.error || 'Failed to upload files')
        throw new Error(error.error || 'Failed to upload files')
      }

      const uploadResult = await uploadResponse.json()
      const metadata: FileMetadata[] = uploadResult.data
      setUploadedFiles(metadata)

      // Step 2: Check for duplicates
      setState("checking")
      setConnectionStatus("Checking for duplicate files")
      const today = new Date().toISOString().split('T')[0]
      const duplicateResponse = await fetch('/api/upload/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: metadata.map(f => ({
            filename: f.filename,
            hash: f.hash,
            date: today,
          }))
        }),
      })

      if (!duplicateResponse.ok) {
        toast.error('Failed to check duplicates')
        throw new Error('Failed to check duplicates')
      }

      const duplicateResult = await duplicateResponse.json()
      const duplicateFilenames = new Set(
        duplicateResult.results
          .filter((r: any) => r.isDuplicate)
          .map((r: any) => r.filename)
      )

      setDuplicateCount(duplicateFilenames.size)

      // Step 3: Start batch processing
      const filesToProcess = metadata.map(f => ({
        filename: f.filename,
        hash: f.hash,
        isDuplicate: duplicateFilenames.has(f.filename),
      }))

      const processResponse = await fetch('/api/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filesToProcess,
          uploadedBy: characterName.trim(),
          node: selectedNode,
        }),
      })

      if (!processResponse.ok) {
        toast.error('Failed to start processing')
        throw new Error('Failed to start processing')
      }

      const processResult = await processResponse.json()
      const newBatchId = processResult.batchId
      setBatchId(newBatchId)

      // Step 4: Connect to SSE stream
      setState("processing")
      setProgressData(prev => ({
        ...prev,
        batchTotal: filesToProcess.length,
      }))

      const eventSource = new EventSource(`/api/upload/progress?batch_id=${newBatchId}`)
      eventSourceRef.current = eventSource
      setConnectionStatus("Connected to processing service")

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'progress':
            addThought('success', `✓ ${data.image} → ${data.itemCount} items`)
            setProgressData(prev => ({
              ...prev,
              batchCurrent: data.batchIndex + 1,
              itemsExtracted: prev.itemsExtracted + data.itemCount,
              tokens: prev.tokens + data.tokenUsage,
            }))
            break

          case 'thought':
            addThought('info', data.summary)
            break

          case 'cache':
            if (data.status === 'created') {
              addThought('success', '⚡ Prompt cache created')
            } else if (data.status === 'reused') {
              addThought('success', '⚡ Prompt cache active')
            }
            // Don't show anything for 'unavailable' - it's handled silently
            break

          case 'duplicate':
            addThought('skip', `⊘ Skipped ${data.filename} (duplicate)`)
            setProgressData(prev => ({
              ...prev,
              batchCurrent: prev.batchCurrent + 1,
              duplicatesSkipped: prev.duplicatesSkipped + 1,
            }))
            break

          case 'chunk-start':
            addThought('info', `━━━ Chunk ${data.chunkIndex}/${data.totalChunks} (${data.filesInChunk} files) ━━━`)
            break

          case 'chunk-complete':
            if (data.failedCount > 0) {
              addThought('info', `Chunk done: ${data.successCount} succeeded, ${data.failedCount} queued for retry`)
            }
            break

          case 'queued-for-retry':
            addThought('retry', `⏳ ${data.filename} → queued for retry`)
            break

          case 'retry-phase':
            addThought('info', `━━━ Retry Phase (${data.failedCount} failed) ━━━`)
            break

          case 'retry':
            addThought('retry', `↻ Retrying ${data.filename}...`)
            break

          case 'retry-complete':
            if (data.recoveredCount > 0 || data.permanentFailures > 0) {
              const msg = data.permanentFailures > 0
                ? `Retry complete: ${data.recoveredCount} recovered, ${data.permanentFailures} failed`
                : `Retry complete: ${data.recoveredCount} recovered`
              addThought(data.permanentFailures > 0 ? 'error' : 'success', msg)
            }
            break

          case 'error':
            if (data.filename === 'system') {
              // System error - abandon everything
              setState('error')
              setErrorMessage(data.message)
              setErrorFilename('System Error')
              eventSource.close()
            } else if (data.message.includes('Failed permanently')) {
              // Permanent failure from retry phase - just log it, don't stop
              addThought('error', `✗ ${data.filename} failed permanently`)
            } else {
              // File-specific error during main processing - show error card
              setState('error')
              setErrorMessage(data.message)
              setErrorFilename(data.filename)
              addThought('error', `✗ Failed to process ${data.filename}: ${data.message}`)
            }
            break

          case 'complete':
            setState('complete')
            setProgressData(prev => ({
              ...prev,
              itemsExtracted: data.totalItems,
              tokens: data.totalTokens,
              duplicatesSkipped: data.skippedCount,
            }))
            const summary = data.failedCount > 0
              ? `Complete: ${data.totalItems} items, ${data.failedCount} failed`
              : `Complete: ${data.totalItems} items extracted`
            addThought('success', `✓ ${summary}`)
            setConnectionStatus(summary)
            eventSource.close()
            break
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        if (state !== 'complete') {
          setState('error')
          setErrorMessage('Connection to server lost')
          setErrorFilename('System Error')
          setConnectionStatus("Connection to server lost")
          toast.error('Connection failed, please try again')
        }
      }

    } catch (error) {
      setState('error')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setErrorMessage(errorMessage)
      setErrorFilename('Upload Error')
      // Only show toast if it wasn't already shown
      if (!errorMessage.includes('upload') && !errorMessage.includes('duplicates') && !errorMessage.includes('processing')) {
        toast.error('Connection failed, please try again')
      }
    }
  }

  const handleSkip = async () => {
    if (!batchId) return

    try {
      const response = await fetch('/api/upload/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })

      if (!response.ok) {
        throw new Error('Failed to skip file')
      }

      // Clear error state and continue processing
      setState('processing')
      setErrorMessage(null)
      setErrorFilename(null)
    } catch (error) {
      console.error('Failed to skip file:', error)
      toast.error('Failed to skip file')
    }
  }

  const handleAbandon = async () => {
    if (!batchId) return

    try {
      const response = await fetch('/api/upload/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })

      if (!response.ok) {
        throw new Error('Failed to abandon batch')
      }

      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      // Reset to idle state
      setState('idle')
      setUploadedFiles([])
      setBatchId(null)
      setThoughts([])
      setProgressData({
        tokens: 0,
        batchCurrent: 0,
        batchTotal: 0,
        itemsExtracted: 0,
        duplicatesSkipped: 0,
      })
      setErrorMessage(null)
      setErrorFilename(null)
      setTotalFilesSelected(0)
      setDuplicateCount(0)
      thoughtIdCounter.current = 0
      toast('Batch abandoned')
    } catch (error) {
      console.error('Failed to abandon batch:', error)
      toast.error('Failed to abandon batch')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  return (
    <div className="px-8 py-6 max-w-5xl">
      {/* Screen reader only status announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {connectionStatus}
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Upload className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Upload Screenshots</h1>
            <p className="text-sm text-muted-foreground">Extract marketplace data with AI vision</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Character Name and Node Selection - Always visible when idle */}
        {state === "idle" && (
          <div className="grid grid-cols-2 gap-4">
            {/* Uploader */}
            <div className="space-y-2">
              <label htmlFor="characterName" className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="size-4" />
                Uploader
              </label>
              <Input
                id="characterName"
                placeholder="Keeps track of your efforts"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                className="h-11 rounded-xl bg-white/[0.03] border-white/10 focus:border-primary/50"
              />
            </div>

            {/* Node Selection */}
            <div className="space-y-2">
              <label htmlFor="nodeSelect" className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="size-4" />
                Node
              </label>
              <Select value={selectedNode} onValueChange={(value) => setSelectedNode(value as NodeType)}>
                <SelectTrigger id="nodeSelect" className="w-full !h-11 !rounded-xl !bg-white/[0.03] border-white/10">
                  <SelectValue placeholder="Select node" />
                </SelectTrigger>
                <SelectContent>
                  {NODES.map((node) => (
                    <SelectItem key={node} value={node}>{node}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Dropzone - Full when idle, compact when processing */}
        {state === "idle" ? (
          <div
            className={cn(
              "relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
              !canUpload && "opacity-50 cursor-not-allowed",
              canUpload && "cursor-pointer",
              isDragging && canUpload
                ? "border-primary bg-primary/5"
                : "border-white/10 hover:border-white/20 bg-white/[0.02]",
              !canUpload && "hover:border-white/10"
            )}
            onDragOver={(e) => { e.preventDefault(); if (canUpload) setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { if (canUpload) handleDrop(e); else e.preventDefault() }}
            onClick={() => { if (canUpload) fileInputRef.current?.click() }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && canUpload) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            role="button"
            tabIndex={canUpload ? 0 : -1}
            aria-label={canUpload ? "Upload screenshots. Click or press Enter to browse files, or drag and drop files here." : "Please fill in character name and select a node before uploading."}
            aria-disabled={!canUpload}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg"
              onChange={handleFileInput}
              className="hidden"
              aria-label="File upload input"
            />

            {/* Animated gradient background on hover/drag */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-chart-3/10 opacity-0 transition-opacity duration-500",
              isDragging && "opacity-100"
            )} />

            <div className="relative py-20 flex flex-col items-center justify-center text-center px-6">
              <div className={cn(
                "relative size-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300",
                isDragging
                  ? "bg-primary scale-110"
                  : "bg-white/5"
              )}>
                {/* Glow effect */}
                {isDragging && (
                  <div className="absolute inset-0 bg-primary/50 blur-xl rounded-2xl" />
                )}
                <Upload className={cn(
                  "size-10 relative transition-colors",
                  isDragging ? "text-primary-foreground" : "text-muted-foreground"
                )} />
              </div>

              <h3 className="text-xl font-semibold mb-2">
                {!canUpload
                  ? "Fill in details above first"
                  : isDragging
                    ? "Release to upload"
                    : "Drop marketplace screenshots"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                {!canUpload
                  ? "Enter your character name and select a node before uploading screenshots."
                  : "Drag and drop your screenshots here, or click to browse. Supports PNG and JPEG files."}
              </p>

              <Button
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10"
                disabled={!canUpload}
              >
                <FileImage className="size-4 mr-2" />
                Browse Files
              </Button>
            </div>
          </div>
        ) : (
          /* Compact header when processing/complete */
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <FileImage className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{totalFilesSelected} screenshot{totalFilesSelected !== 1 ? 's' : ''} selected</p>
                {duplicateCount > 0 && (
                  <p className="text-sm text-muted-foreground">{duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} will be skipped</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Checking Duplicates Panel - Visible when checking */}
        {state === "checking" && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="relative px-6 py-4 border-b border-white/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-chart-3/10 to-primary/10 animate-pulse" />
              <div className="relative flex items-center gap-3">
                <div className="relative">
                  <Brain className="size-5 text-primary" />
                  <div className="absolute inset-0 bg-primary/50 blur animate-ping" />
                </div>
                <div>
                  <p className="font-semibold">Checking for duplicates</p>
                  <p className="text-xs text-muted-foreground">Analyzing upload history</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>
        )}

        {/* Progress Panel - Visible when processing */}
        {(state === "processing" || state === "uploading") && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            {/* Header with animated gradient */}
            <div className="relative px-6 py-4 border-b border-white/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-chart-3/10 to-primary/10 animate-pulse" />
              <div className="relative flex items-center gap-3">
                <div className="relative">
                  <Brain className="size-5 text-primary" />
                  <div className="absolute inset-0 bg-primary/50 blur animate-ping" />
                </div>
                <div>
                  <p className="font-semibold">AI Processing</p>
                  <p className="text-xs text-muted-foreground">
                    Extracting marketplace data from screenshots
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-muted-foreground">Processing images...</span>
                  <span className="font-mono font-medium">{progressData.batchCurrent}/{progressData.batchTotal}</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-chart-3 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Zap className="size-4" />
                    <span className="text-xs uppercase tracking-wider">Tokens</span>
                  </div>
                  <p className="text-2xl font-bold font-mono">{progressData.tokens.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Brain className="size-4" />
                    <span className="text-xs uppercase tracking-wider">Model</span>
                  </div>
                  <p className="text-lg font-bold">{AI_MODELS.find(m => m.value === selectedModel)?.label || selectedModel}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Package className="size-4" />
                    <span className="text-xs uppercase tracking-wider">Items</span>
                  </div>
                  <p className="text-2xl font-bold font-mono">{progressData.itemsExtracted}</p>
                </div>
              </div>

              {/* AI Thoughts Stream */}
              <div role="region" aria-label="AI processing log">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-sm font-medium" id="processing-log-label">AI Processing Log</span>
                </div>
                <ScrollArea className="h-52 rounded-xl border border-white/5 bg-black/20" aria-labelledby="processing-log-label">
                  <div className="p-4 space-y-2 font-mono text-xs" role="log" aria-live="polite" aria-atomic="false">
                    {thoughts.map((thought) => (
                      <div key={thought.id} className="flex items-start gap-3 py-1">
                        <span className="text-muted-foreground/50 w-12 shrink-0">[{String(thought.id).padStart(2, '0')}]</span>
                        <span className={cn(
                          thought.type === "success" && "text-emerald-400",
                          thought.type === "skip" && "text-yellow-400",
                          thought.type === "error" && "text-red-400",
                          thought.type === "retry" && "text-orange-400",
                          thought.type === "info" && "text-muted-foreground"
                        )}>
                          {thought.message}
                        </span>
                      </div>
                    ))}
                    {state === "processing" && (
                      <div className="flex items-center gap-3 py-1">
                        <span className="text-muted-foreground/50 w-12 shrink-0">[{String(thoughts.length + 1).padStart(2, '0')}]</span>
                        <span className="text-primary animate-pulse">Processing...</span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}

        {/* Error Card */}
        {state === "error" && errorMessage && errorFilename && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden" role="alert" aria-live="assertive">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="size-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-400 mb-1">Processing Failed</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Failed to process <span className="font-mono text-foreground">{errorFilename}</span>.{' '}
                    {errorMessage}
                  </p>
                  <div className="flex gap-3">
                    <Button size="sm" className="bg-white/10 hover:bg-white/20 text-foreground" onClick={handleSkip} aria-label="Skip failed file and continue processing">
                      <SkipForward className="size-4 mr-2" />
                      Skip & Continue
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleAbandon} aria-label="Abandon entire batch">
                      <XCircle className="size-4 mr-2" />
                      Abandon Batch
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion Card */}
        {state === "complete" && (
          <div className="relative rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
            {/* Success glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/20 blur-[80px]" />

            <div className="relative p-8 text-center">
              <div className="relative inline-flex mb-6">
                <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full" />
                <div className="relative size-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="size-10 text-white" />
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-2">Upload Complete!</h3>
              <p className="text-muted-foreground mb-8">
                Processed <span className="text-foreground font-semibold">{totalFilesSelected - progressData.duplicatesSkipped} image{totalFilesSelected - progressData.duplicatesSkipped !== 1 ? 's' : ''}</span> and extracted <span className="text-emerald-400 font-semibold">{progressData.itemsExtracted} item{progressData.itemsExtracted !== 1 ? 's' : ''}</span>
              </p>

              <div className="flex justify-center gap-4">
                <Button render={<a href="/market" />} className="h-11 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white glow-success">
                  View in Market Explorer
                  <ArrowRight className="size-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  className="h-11 px-6 border-white/10"
                  onClick={() => {
                    setState("idle")
                    setUploadedFiles([])
                    setBatchId(null)
                    setThoughts([])
                    setProgressData({
                      tokens: 0,
                      batchCurrent: 0,
                      batchTotal: 0,
                      itemsExtracted: 0,
                      duplicatesSkipped: 0,
                    })
                    setTotalFilesSelected(0)
                    setDuplicateCount(0)
                    thoughtIdCounter.current = 0
                  }}
                >
                  Upload More
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Stats */}
        {state !== "idle" && state !== "uploading" && state !== "checking" && (
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">{progressData.itemsExtracted} extracted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">{progressData.duplicatesSkipped} skipped</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">{progressData.tokens.toLocaleString()} tokens</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
