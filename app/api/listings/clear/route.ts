import { NextResponse } from 'next/server'
import { db, marketplaceListings, uploadHistory, priceHistory } from '@/db'

export async function POST() {
  try {
    // Delete all marketplace listings
    const listingsResult = await db.delete(marketplaceListings).returning({ id: marketplaceListings.id })

    // Also clear upload history and price history
    const uploadsResult = await db.delete(uploadHistory).returning({ id: uploadHistory.id })
    const pricesResult = await db.delete(priceHistory).returning({ id: priceHistory.id })

    return NextResponse.json({
      listings: listingsResult.length,
      uploads: uploadsResult.length,
      prices: pricesResult.length,
    })
  } catch (error) {
    console.error('Failed to clear all data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
