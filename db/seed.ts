import { db } from './index'
import { settings } from './schema'
import { sql } from 'drizzle-orm'

async function seed() {
  try {
    console.log('Starting database seeding...')

    // Insert default settings with upsert pattern
    await db
      .insert(settings)
      .values([
        {
          key: 'trend_period_days',
          value: { days: 14 },
        },
        {
          key: 'upload_retention_days',
          value: { days: 180 },
        },
      ])
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: sql`excluded.value`,
        },
      })

    console.log('✓ Default settings inserted successfully')
    console.log('  - trend_period_days: 14')
    console.log('  - upload_retention_days: 180')

    process.exit(0)
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }
}

seed()
