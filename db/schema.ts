import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  timestamp,
  date,
  jsonb,
  index,
  text,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Enums
export const rarityEnum = pgEnum('rarity', [
  'Common',
  'Uncommon',
  'Rare',
  'Heroic',
  'Epic',
  'Legendary',
])

export const nodeEnum = pgEnum('node', [
  'New Aela',
  'Halcyon',
  'Joeva',
  'Miraleth',
  'Winstead',
])

export const uploadStatusEnum = pgEnum('upload_status', [
  'success',
  'failed',
  'skipped',
  'abandoned',
])

// Tables
export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    itemName: varchar('item_name', { length: 255 }).notNull(),
    sellerName: varchar('seller_name', { length: 255 }).notNull(),
    quantity: integer('quantity').notNull(),
    rarity: rarityEnum('rarity').notNull(),
    priceGold: integer('price_gold').notNull(),
    priceSilver: integer('price_silver').notNull(),
    priceCopper: integer('price_copper').notNull(),
    totalPriceCopper: integer('total_price_copper').notNull(),
    node: nodeEnum('node').notNull(),
    uploadedBy: varchar('uploaded_by', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    activeListingsIdx: index('active_listings_idx').on(table.deletedAt).where(sql`${table.deletedAt} IS NULL`),
    itemNameRarityIdx: index('item_name_rarity_idx').on(table.itemName, table.rarity),
    createdAtIdx: index('created_at_idx').on(table.createdAt.desc()),
  })
)

export const uploadHistory = pgTable(
  'upload_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileName: varchar('file_name', { length: 500 }).notNull(),
    fileHash: varchar('file_hash', { length: 64 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    itemCount: integer('item_count').notNull(),
    tokenUsage: integer('token_usage').notNull(),
    status: uploadStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
    uploadedBy: varchar('uploaded_by', { length: 100 }),
    node: nodeEnum('node'),
  },
  (table) => ({
    fileHashIdx: index('file_hash_idx').on(table.fileHash),
    processedAtIdx: index('processed_at_idx').on(table.processedAt.desc()),
  })
)

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    itemName: varchar('item_name', { length: 255 }).notNull(),
    rarity: rarityEnum('rarity').notNull(),
    date: date('date').notNull(),
    avgPrice: integer('avg_price').notNull(),
    minPrice: integer('min_price').notNull(),
    maxPrice: integer('max_price').notNull(),
    listingCount: integer('listing_count').notNull(),
  },
  (table) => ({
    itemNameRarityDateIdx: index('item_name_rarity_date_idx').on(
      table.itemName,
      table.rarity,
      table.date.desc()
    ),
    dateIdx: index('date_idx').on(table.date),
  })
)

export const settings = pgTable('settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
})
