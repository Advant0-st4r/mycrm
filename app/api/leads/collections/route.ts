import { NextResponse } from 'next/server'
import { count, desc, eq, ne } from 'drizzle-orm'
import { sharedDb } from '@/lib/shared-db'
import { leadCollections, leadHistory } from '@/lib/shared-schema'

export async function GET() {
  try {
    const collections = await sharedDb
      .select({
        collectionId: leadCollections.collectionId,
        createdAt: leadCollections.createdAt,
        restaurantCount: count(leadHistory.googlePlaceId),
      })
      .from(leadCollections)
      .leftJoin(leadHistory, eq(leadCollections.collectionId, leadHistory.collectionId))
      .where(ne(leadCollections.collectionId, '00000000-0000-4000-8000-000000000001'))
      .groupBy(leadCollections.collectionId)
      .orderBy(desc(leadCollections.createdAt))
      .limit(100)

    return NextResponse.json({ collections })
  } catch {
    return NextResponse.json({ error: 'Could not load collection history' }, { status: 500 })
  }
}
