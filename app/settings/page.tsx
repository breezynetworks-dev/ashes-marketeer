"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Trash2, Database, HardDrive, Settings, Clock, Flame, Brain, DollarSign, FileText, Lock, ArrowRight, AlertCircle, Server } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AI_MODELS, DEFAULT_MODEL, type AIModel, getModelConfig, EXTRACTION_PROMPT } from "@/lib/ai-extraction"

interface Stats {
  totalListings: number
  totalUploads: number
  totalItems: number
  oldestUpload: string | null
  newestUpload: string | null
  avgItemsPerUpload: number
  totalTokensUsed: number
}

export default function SettingsPage() {
  // Admin auth state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [adminCode, setAdminCode] = useState("")
  const [adminError, setAdminError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Settings state
  const [clearPeriod, setClearPeriod] = useState("90")
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [aiModel, setAiModel] = useState<AIModel>(DEFAULT_MODEL)
  const [isSavingAiModel, setIsSavingAiModel] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<{ openai: boolean; anthropic: boolean; google: boolean }>({ openai: true, anthropic: false, google: false })
  const [usageData, setUsageData] = useState<{ totalTokens: number; totalImages: number; lastUpdated: string | null }>({ totalTokens: 0, totalImages: 0, lastUpdated: null })

  // Check admin auth on mount
  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const response = await fetch('/api/auth/admin/check')
        const data = await response.json()
        setIsAdminAuthenticated(data.authenticated)
      } catch (error) {
        console.error('Failed to check admin auth:', error)
        setIsAdminAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAdminAuth()
  }, [])

  // Admin login handler
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!adminCode.trim()) {
      setAdminError("Please enter the admin code")
      return
    }

    setIsLoggingIn(true)
    setAdminError("")

    try {
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: adminCode }),
      })

      if (response.ok) {
        setIsAdminAuthenticated(true)
        setAdminCode("")
      } else {
        const data = await response.json()
        setAdminError(data.error || "Invalid admin code")
      }
    } catch {
      setAdminError("Something went wrong. Please try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        // Fetch AI model settings, providers, and usage tracking in parallel
        const [modelResponse, providersResponse, usageResponse] = await Promise.all([
          fetch('/api/settings/ai_extraction_model'),
          fetch('/api/ai-providers'),
          fetch('/api/settings/usage_tracking'),
        ])

        if (modelResponse.ok) {
          const data = await modelResponse.json()
          if (data.value?.model) {
            setAiModel(data.value.model as AIModel)
          }
        }

        if (providersResponse.ok) {
          const data = await providersResponse.json()
          setAvailableProviders(data)
        }

        if (usageResponse.ok) {
          const data = await usageResponse.json()
          if (data.value) {
            setUsageData({
              totalTokens: data.value.totalTokens || 0,
              totalImages: data.value.totalImages || 0,
              lastUpdated: data.value.lastUpdated || null,
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
        toast.error('Failed to load settings')
      } finally {
        setIsLoadingSettings(false)
      }
    }
    fetchSettings()
  }, [])

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      setIsLoadingStats(true)
      const response = await fetch('/api/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      toast.error('Failed to load statistics')
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Auto-save AI model when changed
  async function handleAiModelChange(value: AIModel | null) {
    if (!value) return
    setAiModel(value)
    setIsSavingAiModel(true)
    try {
      const response = await fetch('/api/settings/ai_extraction_model', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!response.ok) throw new Error('Failed to save setting')
      toast.success('AI model updated')
    } catch (error) {
      console.error('Failed to save AI model:', error)
      toast.error('Failed to save AI model')
    } finally {
      setIsSavingAiModel(false)
    }
  }

  // Check if a model is available - only Gemini 3 Flash is enabled
  function isModelAvailable(modelValue: AIModel): boolean {
    // Only allow Gemini 3 Flash
    if (modelValue !== 'gemini-3-flash-preview') return false
    return availableProviders.google
  }

  // Handler for clear period select
  function handleClearPeriodChange(value: string | null) {
    if (value) setClearPeriod(value)
  }

  // Clear history handler
  async function handleClearHistory() {
    setIsClearingHistory(true)
    try {
      const keepDays = clearPeriod === 'all' ? 'all' : parseInt(clearPeriod)
      const response = await fetch('/api/history/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepDays }),
      })
      if (!response.ok) throw new Error('Failed to clear history')
      const data = await response.json()

      // Show success toast
      if (keepDays === 'all') {
        toast.success('All historical data cleared')
      } else {
        toast.success(`Historical data cleared (kept last ${keepDays} days)`)
      }

      // Refresh stats
      await fetchStats()

      // Close dialog
      setDialogOpen(false)
    } catch (error) {
      console.error('Failed to clear history:', error)
      toast.error('Failed to clear history')
    } finally {
      setIsClearingHistory(false)
    }
  }

  // Format date helper
  function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  }

  // Get warning text based on clear period
  function getWarningText() {
    if (clearPeriod === 'all') {
      return [
        'All upload history will be deleted',
        'All price history will be deleted',
        'Current marketplace listings are not affected',
      ]
    }
    return [
      `Upload history older than ${clearPeriod} days will be deleted`,
      `Price history older than ${clearPeriod} days will be deleted`,
      'Current marketplace listings are not affected',
    ]
  }

  // Get dialog description
  function getDialogDescription() {
    if (clearPeriod === 'all') {
      return 'This action cannot be undone. This will permanently delete all upload history and price history records.'
    }
    return `This action cannot be undone. This will permanently delete all upload history and price history records older than ${clearPeriod} days.`
  }

  // Clear all data handler
  async function handleClearAll() {
    setIsClearingAll(true)
    try {
      const response = await fetch('/api/listings/clear', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to clear all data')
      const data = await response.json()

      toast.success(`Cleared ${data.listings} listings, ${data.uploads} uploads, ${data.prices} price records`)

      // Refresh stats
      await fetchStats()

      // Close dialog
      setClearAllDialogOpen(false)
    } catch (error) {
      console.error('Failed to clear all data:', error)
      toast.error('Failed to clear all data')
    } finally {
      setIsClearingAll(false)
    }
  }

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="px-8 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Settings className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure preferences and manage data</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // Show admin login if not authenticated
  if (!isAdminAuthenticated) {
    return (
      <div className="px-8 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Settings className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure preferences and manage data</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden max-w-md">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Lock className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Admin Access Required</h2>
                <p className="text-sm text-muted-foreground">Enter the admin code to continue</p>
              </div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Admin code"
                  value={adminCode}
                  onChange={(e) => {
                    setAdminCode(e.target.value)
                    setAdminError("")
                  }}
                  className="pl-11 h-12 bg-white/[0.03] border-white/10 focus:border-primary/50"
                  disabled={isLoggingIn}
                  autoFocus
                />
              </div>

              {adminError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-chart-3 hover:opacity-90"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Enter Settings
                    <ArrowRight className="size-4" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Settings className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure preferences and manage data</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Extraction & Server Memory - Side by Side */}
        <div className="grid grid-cols-2 gap-6">
          {/* AI Extraction Model */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-xl bg-gradient-to-br from-chart-5/20 to-chart-5/5 flex items-center justify-center shrink-0">
                  <Brain className="size-5 text-chart-5" />
                </div>
                <h2 className="font-semibold">AI Extraction Model</h2>
              </div>
              <div className="mb-4">
                <Select value={aiModel} onValueChange={handleAiModelChange} disabled={isLoadingSettings || isSavingAiModel}>
                  <SelectTrigger className="w-full bg-white/[0.03] border-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((model) => {
                      const available = isModelAvailable(model.value)
                      return (
                        <SelectItem
                          key={model.value}
                          value={model.value}
                          disabled={!available}
                          className={cn(!available && "opacity-50")}
                        >
                          <div className="flex items-center gap-2">
                            <span>{model.label}</span>
                            <span className="text-xs text-muted-foreground">({model.provider})</span>
                            {!available && <span className="text-xs text-muted-foreground">Disabled</span>}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-muted-foreground/70">Parallel processing</div>
                  <div className="font-mono text-foreground">{getModelConfig(aiModel).maxConcurrent} concurrent</div>

                  <div className="text-muted-foreground/70">Chunk delay</div>
                  <div className="font-mono text-foreground">{getModelConfig(aiModel).delayBetweenMs}ms</div>

                  <div className="text-muted-foreground/70">Prompt caching</div>
                  <div className="font-mono text-foreground">Enabled (~90% saved)</div>

                  <div className="text-muted-foreground/70">Cache TTL</div>
                  <div className="font-mono text-foreground">1 hour</div>

                  <div className="text-muted-foreground/70">Failed retry</div>
                  <div className="font-mono text-foreground">End of batch</div>
                </div>
              </div>
            </div>
          </div>

          {/* Server Memory Management */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center shrink-0">
                  <Server className="size-5 text-cyan-500" />
                </div>
                <h2 className="font-semibold">Server Memory</h2>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-muted-foreground/70">Storage</div>
                  <div className="font-mono text-foreground">In-memory only</div>

                  <div className="text-muted-foreground/70">Cleanup (success)</div>
                  <div className="font-mono text-foreground">Immediate</div>

                  <div className="text-muted-foreground/70">Cleanup (failure)</div>
                  <div className="font-mono text-foreground">Immediate</div>

                  <div className="text-muted-foreground/70">Cleanup (duplicate)</div>
                  <div className="font-mono text-foreground">Immediate</div>

                  <div className="text-muted-foreground/70">Abandoned TTL</div>
                  <div className="font-mono text-foreground">60 minutes</div>

                  <div className="text-muted-foreground/70">Background sweep</div>
                  <div className="font-mono text-foreground">Every 2 min</div>

                  <div className="text-muted-foreground/70">Duplicate check</div>
                  <div className="font-mono text-foreground">Hash + date</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Estimated Costs & Retention - Side by Side */}
        <div className="grid grid-cols-2 gap-6">
          {/* Estimated Costs */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="p-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center shrink-0">
                  <DollarSign className="size-5 text-green-500" />
                </div>
                <h2 className="font-semibold">Estimated Costs</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Images</p>
                  <p className="text-lg font-bold font-mono">{usageData.totalImages.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tokens</p>
                  <p className="text-lg font-bold font-mono">{(usageData.totalTokens / 1000).toFixed(1)}k</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Est. Cost</p>
                  <p className="text-lg font-bold font-mono text-green-400">
                    ${((usageData.totalTokens / 1_000_000) * 0.30).toFixed(4)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/50">
                Gemini 3 Flash ~$0.30/1M tokens
              </p>
            </div>
          </div>

          {/* Upload History Retention */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="p-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <HardDrive className="size-5 text-muted-foreground" />
                </div>
                <h2 className="font-semibold">Upload History Retention</h2>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-muted-foreground/70">Retention period</div>
                  <div className="font-mono text-foreground">6 months</div>

                  <div className="text-muted-foreground/70">Purpose</div>
                  <div className="font-mono text-foreground">Price trends</div>

                  <div className="text-muted-foreground/70">Auto cleanup</div>
                  <div className="font-mono text-foreground">Enabled</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground/50">
                Price history older than 6 months is automatically removed
              </p>
            </div>
          </div>
        </div>

        {/* Extraction Prompt */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center shrink-0">
                <FileText className="size-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-semibold">Extraction Prompt</h2>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white/5 text-muted-foreground">
                    Read-only
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  System prompt used for AI extraction. This prompt is cached to reduce tokens per call.
                </p>
                <ScrollArea className="h-[32rem] rounded-xl bg-black/30 border border-white/5">
                  <div className="p-4">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {EXTRACTION_PROMPT}
                    </pre>
                  </div>
                </ScrollArea>
                <p className="mt-3 text-xs text-muted-foreground/50">
                  ~1,100 tokens • Cached for 1 hour per session
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 text-xs text-muted-foreground uppercase tracking-wider">
              Danger Zone
            </span>
          </div>
        </div>

        {/* Clear Historical Data */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="size-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-red-400 mb-1">Clear Historical Data</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete old price history and upload records
                </p>

                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm">Keep data from:</span>
                  <Select value={clearPeriod} onValueChange={handleClearPeriodChange}>
                    <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="60">Last 60 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="180">Last 180 days</SelectItem>
                      <SelectItem value="all">Delete all history</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-4 text-yellow-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-yellow-400 font-medium mb-1">This action is permanent</p>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        {getWarningText().map((text, idx) => (
                          <li key={idx}>• {text}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-0"
                        disabled={!stats || stats.totalUploads === 0}
                      >
                        <Trash2 className="size-4 mr-2" />
                        Clear History
                      </Button>
                    }
                  />
                  <AlertDialogContent className="border-white/10 bg-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {getDialogDescription()}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-white/10" disabled={isClearingHistory}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-500 hover:bg-red-600 text-white"
                        onClick={(e) => {
                          e.preventDefault()
                          handleClearHistory()
                        }}
                        disabled={isClearingHistory}
                      >
                        {isClearingHistory ? 'Deleting...' : 'Yes, delete history'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        {/* Clear All Data */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Flame className="size-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-red-400 mb-1">Clear All Data</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete all marketplace listings, upload history, and price records
                </p>

                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-red-400 font-medium mb-1">This will delete everything</p>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• All marketplace listings will be deleted</li>
                        <li>• All upload history will be deleted</li>
                        <li>• All price history will be deleted</li>
                        <li>• Database will be completely empty</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-0"
                        disabled={!stats || (stats.totalListings === 0 && stats.totalUploads === 0)}
                      >
                        <Trash2 className="size-4 mr-2" />
                        Clear All Data
                      </Button>
                    }
                  />
                  <AlertDialogContent className="border-white/10 bg-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-400">Delete all data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all marketplace listings, upload history, and price history records. Your database will be completely empty.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-white/10" disabled={isClearingAll}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-500 hover:bg-red-600 text-white"
                        onClick={(e) => {
                          e.preventDefault()
                          handleClearAll()
                        }}
                        disabled={isClearingAll}
                      >
                        {isClearingAll ? 'Deleting...' : 'Yes, delete everything'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
