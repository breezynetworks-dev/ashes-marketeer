import { db, marketplaceListings, priceHistory } from '@/db'
import { sql, isNull, eq, and } from 'drizzle-orm'

interface AggregationResult {
  itemName: string
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Heroic' | 'Epic' | 'Legendary'
  date: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  listingCount: number
}

export async function aggregatePrices() {
  console.log('Starting price aggregation...')

  try {
    // Query marketplace_listings grouped by itemName, rarity, and DATE(createdAt)
    // Only include listings that haven't been deleted (deletedAt IS NULL)
    const results = await db
      .select({
        itemName: marketplaceListings.itemName,
        rarity: marketplaceListings.rarity,
        date: sql<string>`DATE(${marketplaceListings.createdAt})`.as('date'),
        avgPrice: sql<number>`ROUND(AVG(${marketplaceListings.totalPriceCopper}))`.as('avg_price'),
        minPrice: sql<number>`MIN(${marketplaceListings.totalPriceCopper})`.as('min_price'),
        maxPrice: sql<number>`MAX(${marketplaceListings.totalPriceCopper})`.as('max_price'),
        listingCount: sql<number>`COUNT(*)`.as('listing_count'),
      })
      .from(marketplaceListings)
      .where(isNull(marketplaceListings.deletedAt))
      .groupBy(
        marketplaceListings.itemName,
        marketplaceListings.rarity,
        sql`DATE(${marketplaceListings.createdAt})`
      )

    console.log(`Found ${results.length} item-rarity-date groups to aggregate`)

    // Upsert each result into price_history
    let createdCount = 0
    let updatedCount = 0

    for (const result of results as AggregationResult[]) {
      // Check if record exists
      const existing = await db
        .select()
        .from(priceHistory)
        .where(
          and(
            eq(priceHistory.itemName, result.itemName),
            eq(priceHistory.rarity, result.rarity),
            eq(priceHistory.date, result.date)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(priceHistory)
          .set({
            avgPrice: Math.round(result.avgPrice),
            minPrice: result.minPrice,
            maxPrice: result.maxPrice,
            listingCount: result.listingCount,
          })
          .where(
            and(
              eq(priceHistory.itemName, result.itemName),
              eq(priceHistory.rarity, result.rarity),
              eq(priceHistory.date, result.date)
            )
          )
        updatedCount++
      } else {
        // Insert new record
        await db.insert(priceHistory).values({
          itemName: result.itemName,
          rarity: result.rarity,
          date: result.date,
          avgPrice: Math.round(result.avgPrice),
          minPrice: result.minPrice,
          maxPrice: result.maxPrice,
          listingCount: result.listingCount,
        })
        createdCount++
      }
    }

    console.log(`Aggregation complete:`)
    console.log(`  - ${results.length} unique item-rarity-date combinations`)
    console.log(`  - ${createdCount} new records created`)
    console.log(`  - ${updatedCount} existing records updated`)

    return {
      totalGroups: results.length,
      created: createdCount,
      updated: updatedCount,
    }
  } catch (error) {
    console.error('Error during price aggregation:', error)
    throw error
  }
}

// Run the aggregation if this file is executed directly
if (require.main === module) {
  aggregatePrices()
    .then(() => {
      console.log('Price aggregation completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Price aggregation failed:', error)
      process.exit(1)
    })
}
