import { NextRequest, NextResponse } from 'next/server'
import { sharedDb } from '@/lib/shared-db'
import { leadCollections, leadHistory } from '@/lib/shared-schema'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const payload: unknown = await request.json()
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { collectionId, placeIds } = payload as { collectionId?: unknown; placeIds?: unknown }
    if (typeof collectionId !== 'string' || !UUID_PATTERN.test(collectionId)) {
      return NextResponse.json({ error: 'A valid collectionId is required' }, { status: 400 })
    }
    if (!Array.isArray(placeIds) || placeIds.length > 100) {
      return NextResponse.json({ error: 'placeIds must be an array of at most 100 IDs' }, { status: 400 })
    }
    if (placeIds.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 512)) {
      return NextResponse.json({ error: 'Every place ID must be a non-empty string of at most 512 characters' }, { status: 400 })
    }

    await sharedDb.insert(leadCollections)
      .values({ collectionId })
      .onConflictDoNothing()

    const uniqueIds = [...new Set(placeIds as string[])]
    if (uniqueIds.length === 0) return NextResponse.json({ acceptedIds: [] })

    const accepted = await sharedDb.insert(leadHistory)
      .values(uniqueIds.map((googlePlaceId) => ({ googlePlaceId, collectionId })))
      .onConflictDoNothing({ target: leadHistory.googlePlaceId })
      .returning({ googlePlaceId: leadHistory.googlePlaceId })

    return NextResponse.json({ acceptedIds: accepted.map((row) => row.googlePlaceId) })
  } catch {
    return NextResponse.json({ error: 'Could not reserve restaurant IDs' }, { status: 500 })
  }
}
