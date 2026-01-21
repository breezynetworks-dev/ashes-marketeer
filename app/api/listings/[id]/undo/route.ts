import { NextRequest, NextResponse } from 'next/server'
import { db, marketplaceListings } from '@/db'
import { eq, and, isNotNull } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if listing exists and IS deleted
    const [existingListing] = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.id, id),
          isNotNull(marketplaceListings.deletedAt)
        )
      )

    if (!existingListing) {
      return NextResponse.json(
        { error: 'Deleted listing not found' },
        { status: 404 }
      )
    }

    // Restore listing: clear deletedAt
    await db
      .update(marketplaceListings)
      .set({ deletedAt: null })
      .where(eq(marketplaceListings.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to restore listing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
