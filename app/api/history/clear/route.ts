import { NextRequest, NextResponse } from 'next/server'
import { db, uploadHistory, priceHistory } from '@/db'
import { lt, sql } from 'drizzle-orm'

interface ClearHistoryRequest {
  keepDays: number | 'all'
}

export async function POST(request: NextRequest) {
  try {
    const body: ClearHistoryRequest = await request.json()

    if (body.keepDays === undefined || body.keepDays === null) {
      return NextResponse.json(
        { error: 'keepDays is required' },
        { status: 400 }
      )
    }

    if (
      body.keepDays !== 'all' &&
      (typeof body.keepDays !== 'number' || body.keepDays < 0)
    ) {
      return NextResponse.json(
        { error: 'keepDays must be a positive number or "all"' },
        { status: 400 }
      )
    }

    let uploadHistoryDeleted: number
    let priceHistoryDeleted: number

    if (body.keepDays === 'all') {
      // Delete all records from both tables
      const uploadResult = await db.delete(uploadHistory)
      const priceResult = await db.delete(priceHistory)

      uploadHistoryDeleted = uploadResult.rowCount ?? 0
      priceHistoryDeleted = priceResult.rowCount ?? 0
    } else {
      // Calculate cutoff date
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - body.keepDays)

      // Delete upload_history records older than cutoff (using processedAt)
      const uploadResult = await db
        .delete(uploadHistory)
        .where(lt(uploadHistory.processedAt, cutoffDate))

      uploadHistoryDeleted = uploadResult.rowCount ?? 0

      // Delete price_history records older than cutoff (using date field)
      // Need to convert date field to string for comparison (format: YYYY-MM-DD)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]
      const priceResult = await db
        .delete(priceHistory)
        .where(sql`${priceHistory.date} < ${cutoffDateStr}`)

      priceHistoryDeleted = priceResult.rowCount ?? 0
    }

    return NextResponse.json({
      uploadHistory: uploadHistoryDeleted,
      priceHistory: priceHistoryDeleted,
    })
  } catch (error) {
    console.error('Failed to clear history:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
