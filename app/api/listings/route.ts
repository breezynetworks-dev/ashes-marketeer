import { NextRequest, NextResponse } from 'next/server'
import { db, marketplaceListings } from '@/db'
import { eq, and, isNull, ilike, desc, asc, count, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const rarity = searchParams.get('rarity')
    const node = searchParams.get('node')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build WHERE conditions
    const conditions = [isNull(marketplaceListings.deletedAt)]

    if (search) {
      conditions.push(ilike(marketplaceListings.itemName, `%${search}%`))
    }

    if (rarity) {
      conditions.push(eq(marketplaceListings.rarity, rarity as any))
    }

    if (node) {
      conditions.push(eq(marketplaceListings.node, node as any))
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

    // Determine sort column
    const sortColumn = sortBy === 'createdAt'
      ? marketplaceListings.createdAt
      : sortBy === 'itemName'
      ? marketplaceListings.itemName
      : sortBy === 'totalPriceCopper'
      ? marketplaceListings.totalPriceCopper
      : sortBy === 'rarity'
      ? marketplaceListings.rarity
      : marketplaceListings.createdAt

    // Determine sort order
    const orderClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(marketplaceListings)
      .where(whereClause)

    // Get listings
    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(whereClause)
      .orderBy(orderClause)

    // Format the response data
    const formattedListings = listings.map(listing => ({
      id: listing.id,
      seller: listing.sellerName,
      item: listing.itemName,
      quantity: listing.quantity,
      rarity: listing.rarity,
      prices: {
        gold: listing.priceGold,
        silver: listing.priceSilver,
        copper: listing.priceCopper,
        total: listing.totalPriceCopper,
      },
      node: listing.node,
      uploadedBy: listing.uploadedBy,
      timestamp: listing.createdAt,
    }))

    return NextResponse.json({
      listings: formattedListings,
      total: totalResult.count,
    })
  } catch (error) {
    console.error('Failed to fetch listings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
