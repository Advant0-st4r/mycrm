import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './shared-schema'

const globalForDb = globalThis as typeof globalThis & { restaurantLeadPool?: Pool }

const pool = globalForDb.restaurantLeadPool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') globalForDb.restaurantLeadPool = pool

export const sharedDb = drizzle(pool, { schema })
