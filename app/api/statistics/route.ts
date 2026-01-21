import { NextResponse } from 'next/server'
import { db, marketplaceListings, uploadHistory } from '@/db'
import { sql, isNull, count, sum } from 'drizzle-orm'

export async function GET() {
  try {
    // Get listings per node
    const listingsPerNode = await db
      .select({
        node: marketplaceListings.node,
        count: count(),
      })
      .from(marketplaceListings)
      .where(isNull(marketplaceListings.deletedAt))
      .groupBy(marketplaceListings.node)

    // Get total items captured (sum of itemCount from successful uploads)
    const totalItemsResult = await db
      .select({
        total: sum(uploadHistory.itemCount),
      })
      .from(uploadHistory)
      .where(sql`${uploadHistory.status} = 'success'`)

    const totalItems = Number(totalItemsResult[0]?.total) || 0

    // Get total uploads count
    const totalUploadsResult = await db
      .select({
        count: count(),
      })
      .from(uploadHistory)
      .where(sql`${uploadHistory.status} = 'success'`)

    const totalUploads = totalUploadsResult[0]?.count || 0

    // Get leaderboard (uploads per person)
    const leaderboard = await db
      .select({
        uploader: uploadHistory.uploadedBy,
        uploads: count(),
        items: sum(uploadHistory.itemCount),
      })
      .from(uploadHistory)
      .where(sql`${uploadHistory.status} = 'success' AND ${uploadHistory.uploadedBy} IS NOT NULL`)
      .groupBy(uploadHistory.uploadedBy)
      .orderBy(sql`${sum(uploadHistory.itemCount)} DESC`)
      .limit(10)

    return NextResponse.json({
      listingsPerNode: listingsPerNode.map(row => ({
        node: row.node,
        count: row.count,
      })),
      totalItems,
      totalUploads,
      leaderboard: leaderboard.map(row => ({
        uploader: row.uploader,
        uploads: row.uploads,
        items: Number(row.items) || 0,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
