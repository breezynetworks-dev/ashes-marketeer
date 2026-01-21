import { db, marketplaceListings, uploadHistory, priceHistory } from './index'

async function clearAll() {
  console.log('Clearing all data...')

  const listings = await db.delete(marketplaceListings).returning({ id: marketplaceListings.id })
  console.log(`✓ Deleted ${listings.length} marketplace listings`)

  const uploads = await db.delete(uploadHistory).returning({ id: uploadHistory.id })
  console.log(`✓ Deleted ${uploads.length} upload history records`)

  const prices = await db.delete(priceHistory).returning({ id: priceHistory.id })
  console.log(`✓ Deleted ${prices.length} price history records`)

  console.log('\nDatabase cleared!')
  process.exit(0)
}

clearAll().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
