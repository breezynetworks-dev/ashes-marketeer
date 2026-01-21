"use client"

import { useState, useEffect } from "react"
import { BarChart3, Package, Upload, Trophy, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Statistics {
  listingsPerNode: { node: string; count: number }[]
  totalItems: number
  totalUploads: number
  leaderboard: { uploader: string; uploads: number; items: number }[]
}

const NODES = ["New Aela", "Halcyon", "Joeva", "Miraleth", "Winstead"] as const

const NODE_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  "New Aela": { bg: "bg-blue-500/10", text: "text-blue-400", glow: "shadow-blue-500/20" },
  "Halcyon": { bg: "bg-emerald-500/10", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
  "Joeva": { bg: "bg-purple-500/10", text: "text-purple-400", glow: "shadow-purple-500/20" },
  "Miraleth": { bg: "bg-amber-500/10", text: "text-amber-400", glow: "shadow-amber-500/20" },
  "Winstead": { bg: "bg-rose-500/10", text: "text-rose-400", glow: "shadow-rose-500/20" },
}

const MEDAL_COLORS = [
  "text-yellow-400", // Gold
  "text-gray-300",   // Silver
  "text-amber-600",  // Bronze
]

export default function StatisticsPage() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/statistics')
        if (!response.ok) throw new Error('Failed to fetch statistics')
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics')
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const totalListings = stats?.listingsPerNode.reduce((sum, node) => sum + node.count, 0) || 0

  const getNodeCount = (nodeName: string) => {
    return stats?.listingsPerNode.find(n => n.node === nodeName)?.count || 0
  }

  return (
    <div className="px-8 py-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <BarChart3 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Statistics</h1>
          <p className="text-sm text-muted-foreground">Overview of marketplace data collection</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Total Items Card */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="size-4" />
              Total Items Captured
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-4xl font-bold text-primary">{stats?.totalItems.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        {/* Active Listings Card */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4" />
              Active Listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-4xl font-bold">{totalListings.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        {/* Total Uploads Card */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Upload className="size-4" />
              Total Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-4xl font-bold">{stats?.totalUploads.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Node Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {NODES.map((node) => {
          const colors = NODE_COLORS[node]
          const count = getNodeCount(node)
          return (
            <Card key={node} className={cn("border-white/5 bg-white/[0.02]", colors.glow)}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className={cn("size-4", colors.text)} />
                  <p className="text-sm font-medium text-muted-foreground">{node}</p>
                </div>
                {isLoading ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <p className={cn("text-4xl font-bold", colors.text)}>{count.toLocaleString()}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Leaderboard */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="size-5 text-yellow-400" />
          <h2 className="text-lg font-semibold">Upload Leaderboard</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02]">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : stats?.leaderboard.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No uploads yet</p>
        ) : (
          <div className="space-y-2">
            {stats?.leaderboard.map((entry, index) => (
              <div
                key={entry.uploader}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl transition-colors",
                  index === 0 && "bg-yellow-500/10 border border-yellow-500/20",
                  index === 1 && "bg-gray-500/10 border border-gray-500/20",
                  index === 2 && "bg-amber-600/10 border border-amber-600/20",
                  index > 2 && "bg-white/[0.02] border border-white/5"
                )}
              >
                {/* Rank */}
                <div className={cn(
                  "size-10 rounded-full flex items-center justify-center font-bold",
                  index < 3 ? MEDAL_COLORS[index] : "text-muted-foreground bg-white/5"
                )}>
                  {index < 3 ? (
                    <Trophy className="size-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">{entry.uploader}</p>
                  <p className="text-sm text-muted-foreground">{entry.uploads} upload{entry.uploads !== 1 ? 's' : ''}</p>
                </div>

                {/* Items */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{entry.items.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">items</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
