import { NextRequest, NextResponse } from 'next/server'
import { db, priceHistory } from '@/db'
import { eq, and, gte, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemName = searchParams.get('item_name')
    const rarity = searchParams.get('rarity')
    const days = parseInt(searchParams.get('days') || '30', 10)

    // Validate required parameters
    if (!itemName || !rarity) {
      return NextResponse.json(
        { error: 'Missing required parameters: item_name and rarity' },
        { status: 400 }
      )
    }

    // Validate days parameter
    if (isNaN(days) || days <= 0) {
      return NextResponse.json(
        { error: 'Invalid days parameter' },
        { status: 400 }
      )
    }

    // Calculate the date threshold (NOW() - days)
    const dateThreshold = sql`CURRENT_DATE - ${days}::integer`

    // Query price history with filters
    const history = await db
      .select({
        date: priceHistory.date,
        avgPrice: priceHistory.avgPrice,
      })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.itemName, itemName),
          eq(priceHistory.rarity, rarity as any),
          gte(priceHistory.date, dateThreshold)
        )
      )
      .orderBy(priceHistory.date)

    // Calculate period average
    let periodAverage = 0
    if (history.length > 0) {
      const sum = history.reduce((acc, record) => acc + record.avgPrice, 0)
      periodAverage = Math.round(sum / history.length)
    }

    return NextResponse.json({
      history: history.map(record => ({
        date: record.date,
        avgPrice: record.avgPrice,
      })),
      periodAverage,
      dataPoints: history.length,
    })
  } catch (error) {
    console.error('Failed to fetch trends:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
