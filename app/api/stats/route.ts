import { NextResponse } from 'next/server'
import { db, marketplaceListings, uploadHistory } from '@/db'
import { isNull, eq, count, sum, avg, min, max, sql } from 'drizzle-orm'

export async function GET() {
  try {
    // Get total active listings (where deleted_at IS NULL)
    const [totalListingsResult] = await db
      .select({ count: count() })
      .from(marketplaceListings)
      .where(isNull(marketplaceListings.deletedAt))

    // Get all stats from upload_history where status = 'success'
    const [uploadStatsResult] = await db
      .select({
        totalUploads: count(),
        totalItems: sum(uploadHistory.itemCount),
        oldestUpload: min(uploadHistory.processedAt),
        newestUpload: max(uploadHistory.processedAt),
        avgItemsPerUpload: avg(uploadHistory.itemCount),
        totalTokensUsed: sum(uploadHistory.tokenUsage),
      })
      .from(uploadHistory)
      .where(eq(uploadHistory.status, 'success'))

    // Handle edge cases where there are no records
    const stats = {
      totalListings: totalListingsResult?.count || 0,
      totalUploads: uploadStatsResult?.totalUploads || 0,
      totalItems: uploadStatsResult?.totalItems ? Number(uploadStatsResult.totalItems) : 0,
      oldestUpload: uploadStatsResult?.oldestUpload || null,
      newestUpload: uploadStatsResult?.newestUpload || null,
      avgItemsPerUpload: uploadStatsResult?.avgItemsPerUpload
        ? Number(Number(uploadStatsResult.avgItemsPerUpload).toFixed(2))
        : 0,
      totalTokensUsed: uploadStatsResult?.totalTokensUsed ? Number(uploadStatsResult.totalTokensUsed) : 0,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
