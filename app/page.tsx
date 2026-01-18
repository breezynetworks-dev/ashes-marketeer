"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Upload, LayoutGrid, TrendingDown, Package, ArrowRight, Zap, Clock, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Stats {
  totalListings: number
  totalUploads: number
  avgItemsPerUpload: number
}

interface RecentUpload {
  id: string
  fileName: string
  processedAt: string
  itemCount: number
  status: string
}

const topDeals = [
  { item: "Mithril Ore", price: "4g 50s", avgPrice: "6g 20s", savings: "27%", rarity: "epic" },
  { item: "Greater Health Potion", price: "2g 10s", avgPrice: "2g 80s", savings: "25%", rarity: "rare" },
  { item: "Dragonscale", price: "12g", avgPrice: "15g 50s", savings: "23%", rarity: "legendary" },
]

const rarityColors: Record<string, string> = {
  common: "text-gray-400",
  uncommon: "text-emerald-400",
  rare: "text-blue-400",
  heroic: "text-purple-400",
  epic: "text-fuchsia-400",
  legendary: "text-orange-400",
}

function formatTimeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    return `${diffDays}d ago`
  }
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, uploadsRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/uploads/recent'),
        ])

        if (!statsRes.ok || !uploadsRes.ok) {
          throw new Error('Failed to fetch data')
        }

        const statsData = await statsRes.json()
        const uploadsData = await uploadsRes.json()

        setStats(statsData)
        setRecentUploads(uploadsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const isEmpty = !loading && stats?.totalListings === 0 && stats?.totalUploads === 0

  if (isEmpty) {
    return (
      <div className="px-8 py-6">
        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Activity className="size-3.5" />
              <span>Live Market Data</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold mb-4 tracking-tight">
              <span className="text-gradient">Market Intelligence</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
              Upload marketplace screenshots, extract pricing data with AI,
              and dominate the Ashes of Creation economy.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-8 bg-gradient-to-r from-primary to-chart-3 hover:opacity-90 glow-primary text-base font-semibold">
                <Link href="/upload">
                  <Upload className="size-5 mr-2" />
                  Upload Screenshots
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 border-white/10 bg-white/5 hover:bg-white/10 text-base">
                <Link href="/market">
                  <LayoutGrid className="size-5 mr-2" />
                  Browse Market
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="size-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="size-10 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-3">Get started by uploading marketplace screenshots</h2>
          <p className="text-muted-foreground mb-8">
            Upload screenshots of the Ashes of Creation marketplace to extract pricing data and start tracking deals.
          </p>
          <Button asChild size="lg" className="h-12 px-8 bg-gradient-to-r from-primary to-chart-3 hover:opacity-90 glow-primary text-base font-semibold">
            <Link href="/upload">
              <Upload className="size-5 mr-2" />
              Upload Screenshots
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      {/* Hero Section */}
      <div className="text-center mb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Activity className="size-3.5" />
            <span>Live Market Data</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold mb-4 tracking-tight">
            <span className="text-gradient">Market Intelligence</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            Upload marketplace screenshots, extract pricing data with AI,
            and dominate the Ashes of Creation economy.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 bg-gradient-to-r from-primary to-chart-3 hover:opacity-90 glow-primary text-base font-semibold">
              <Link href="/upload">
                <Upload className="size-5 mr-2" />
                Upload Screenshots
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 border-white/10 bg-white/5 hover:bg-white/10 text-base">
              <Link href="/market">
                <LayoutGrid className="size-5 mr-2" />
                Browse Market
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {loading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <Skeleton className="size-10 rounded-xl mb-4" />
                <Skeleton className="h-9 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="group relative p-6 rounded-2xl border border-primary/30 bg-primary/[0.03] transition-all duration-300">
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              <div className="relative">
                <div className="size-10 rounded-xl flex items-center justify-center mb-4 bg-primary/20">
                  <Package className="size-5 text-primary" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">
                      {stats?.totalListings.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Total Listings</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              <div className="relative">
                <div className="size-10 rounded-xl flex items-center justify-center mb-4 bg-white/5">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">
                      {stats?.totalUploads.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Uploads</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              <div className="relative">
                <div className="size-10 rounded-xl flex items-center justify-center mb-4 bg-white/5">
                  <TrendingDown className="size-5 text-muted-foreground" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">
                      {Math.round(stats?.avgItemsPerUpload || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Avg Items/Upload</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              <div className="relative">
                <div className="size-10 rounded-xl flex items-center justify-center mb-4 bg-white/5">
                  <Zap className="size-5 text-muted-foreground" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">
                      {recentUploads.length}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Recent Uploads</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-3 rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            <Link href="/upload" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-10 rounded-xl" />
                      <div>
                        <Skeleton className="h-5 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-6 w-8 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </>
            ) : recentUploads.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                <p>No recent uploads yet</p>
              </div>
            ) : (
              recentUploads.map((upload) => (
                <div key={upload.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Upload className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-md">{upload.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimeAgo(upload.processedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{upload.itemCount}</p>
                    <p className="text-xs text-muted-foreground">items</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Deals */}
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Zap className="size-4 text-emerald-400" />
              </div>
              <h2 className="font-semibold">Top Deals</h2>
            </div>
            <Link href="/market" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-white/5">
            {topDeals.map((deal, i) => (
              <div key={i} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("font-medium", rarityColors[deal.rarity])}>{deal.item}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    -{deal.savings}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    <span className="text-yellow-500">{deal.price}</span>
                    <span className="mx-2">←</span>
                    <span className="line-through">{deal.avgPrice}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Link
          href="/upload"
          className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Upload className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Upload Screenshots</h3>
                <p className="text-sm text-muted-foreground">Extract listings with AI</p>
              </div>
            </div>
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          href="/market"
          className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <LayoutGrid className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Market Explorer</h3>
                <p className="text-sm text-muted-foreground">Search & analyze prices</p>
              </div>
            </div>
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>
    </div>
  )
}
