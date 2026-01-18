"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Trash2, TrendingUp, Database, HardDrive, Settings, Clock, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const [trendPeriod, setTrendPeriod] = useState("30")
  const [clearPeriod, setClearPeriod] = useState("90")
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSavingTrendPeriod, setIsSavingTrendPeriod] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings/trend_period_days')
        if (!response.ok) throw new Error('Failed to fetch settings')
        const data = await response.json()
        if (data.value?.days) {
          setTrendPeriod(data.value.days.toString())
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

  // Auto-save trend period when changed
  async function handleTrendPeriodChange(value: string) {
    setTrendPeriod(value)
    setIsSavingTrendPeriod(true)
    try {
      const response = await fetch('/api/settings/trend_period_days', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseInt(value) }),
      })
      if (!response.ok) throw new Error('Failed to save setting')
    } catch (error) {
      console.error('Failed to save trend period:', error)
      toast.error('Failed to save trend period')
    } finally {
      setIsSavingTrendPeriod(false)
    }
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
        {/* Trend Period Setting */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold mb-1">Historical Trend Period</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Time period used for calculating price averages in Market Explorer
                </p>
                <div className="flex items-center gap-4">
                  <Select value={trendPeriod} onValueChange={handleTrendPeriodChange} disabled={isLoadingSettings || isSavingTrendPeriod}>
                    <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="60">Last 60 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    Sparklines will show {trendPeriod}-day trends
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Statistics */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Database className="size-4 text-muted-foreground" />
            </div>
            <h2 className="font-semibold">Data Statistics</h2>
          </div>
          <div className="p-6">
            {isLoadingStats ? (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 h-24 animate-pulse" />
                ))}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Listings</p>
                    <p className="text-3xl font-bold font-mono">{stats.totalListings.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Items</p>
                    <p className="text-3xl font-bold font-mono">{stats.totalItems.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Uploads</p>
                    <p className="text-3xl font-bold font-mono">{stats.totalUploads.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Avg Items/Upload</p>
                    <p className="text-3xl font-bold font-mono">{stats.avgItemsPerUpload.toFixed(1)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>Oldest record: {formatTimeAgo(stats.oldestUpload)}</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Failed to load statistics</div>
            )}
          </div>
        </div>

        {/* Upload History Retention */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <HardDrive className="size-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-semibold">Upload History Retention</h2>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary">
                    6 months
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload history is retained for 6 months to detect duplicate screenshots.
                  Older records are automatically cleaned up.
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
                  <Select value={clearPeriod} onValueChange={setClearPeriod}>
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
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-0"
                      disabled={!stats || stats.totalUploads === 0}
                    >
                      <Trash2 className="size-4 mr-2" />
                      Clear History
                    </Button>
                  </AlertDialogTrigger>
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

        {/* About */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center">
                  <Flame className="size-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Fallen Market</p>
                  <p className="text-sm text-muted-foreground">Marketplace intelligence for Ashes of Creation</p>
                </div>
              </div>
              <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground">
                v1.0.0
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
