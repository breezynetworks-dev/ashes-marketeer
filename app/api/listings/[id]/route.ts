import { NextRequest, NextResponse } from 'next/server'
import { db, marketplaceListings } from '@/db'
import { eq, and, isNull } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if listing exists and is not deleted
    const [existingListing] = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.id, id),
          isNull(marketplaceListings.deletedAt)
        )
      )

    if (!existingListing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      )
    }

    // Build update object with only provided fields
    const updateData: any = {}

    if (body.item_name !== undefined) {
      updateData.itemName = body.item_name
    }
    if (body.seller_name !== undefined) {
      updateData.sellerName = body.seller_name
    }
    if (body.quantity !== undefined) {
      updateData.quantity = body.quantity
    }
    if (body.rarity !== undefined) {
      updateData.rarity = body.rarity
    }
    if (body.node !== undefined) {
      updateData.node = body.node
    }

    // Check if any price field changed
    const priceChanged =
      body.price_gold !== undefined ||
      body.price_silver !== undefined ||
      body.price_copper !== undefined

    if (body.price_gold !== undefined) {
      updateData.priceGold = body.price_gold
    }
    if (body.price_silver !== undefined) {
      updateData.priceSilver = body.price_silver
    }
    if (body.price_copper !== undefined) {
      updateData.priceCopper = body.price_copper
    }

    // Recalculate totalPriceCopper if any price field changed
    if (priceChanged) {
      const gold = body.price_gold !== undefined ? body.price_gold : existingListing.priceGold
      const silver = body.price_silver !== undefined ? body.price_silver : existingListing.priceSilver
      const copper = body.price_copper !== undefined ? body.price_copper : existingListing.priceCopper

      updateData.totalPriceCopper = gold * 10000 + silver * 100 + copper
    }

    // Update listing in database
    const [updatedListing] = await db
      .update(marketplaceListings)
      .set(updateData)
      .where(eq(marketplaceListings.id, id))
      .returning()

    // Format response like GET /api/listings
    const formattedListing = {
      id: updatedListing.id,
      seller: updatedListing.sellerName,
      item: updatedListing.itemName,
      quantity: updatedListing.quantity,
      rarity: updatedListing.rarity,
      prices: {
        gold: updatedListing.priceGold,
        silver: updatedListing.priceSilver,
        copper: updatedListing.priceCopper,
        total: updatedListing.totalPriceCopper,
      },
      node: updatedListing.node,
      uploadedBy: updatedListing.uploadedBy,
      timestamp: updatedListing.createdAt,
    }

    return NextResponse.json(formattedListing)
  } catch (error) {
    console.error('Failed to update listing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if listing exists and is not already deleted
    const [existingListing] = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.id, id),
          isNull(marketplaceListings.deletedAt)
        )
      )

    if (!existingListing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      )
    }

    // Soft delete: set deletedAt to current timestamp
    await db
      .update(marketplaceListings)
      .set({ deletedAt: new Date() })
      .where(eq(marketplaceListings.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete listing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
