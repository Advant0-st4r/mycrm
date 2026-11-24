import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const leadCollections = pgTable('restaurant_lead_collections', {
  collectionId: uuid('collection_id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leadHistory = pgTable('restaurant_lead_history', {
  googlePlaceId: text('google_place_id').primaryKey(),
  collectionId: uuid('collection_id').notNull(),
  firstCollectedAt: timestamp('first_collected_at', { withTimezone: true }).notNull().defaultNow(),
})
