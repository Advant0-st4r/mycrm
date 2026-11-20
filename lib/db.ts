import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { computeCompleteness } from './completeness'
import type { Place, PlaceUpdate } from './types'

interface KraveDB extends DBSchema {
  places: { key: string; value: Place }
}

let dbPromise: Promise<IDBPDatabase<KraveDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<KraveDB>('krave-qatar', 1, {
      upgrade(db) {
        db.createObjectStore('places', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/**
 * Merge incoming fields onto an existing record. Empty incoming values never erase data.
 * With preferExisting, non-empty existing values are also kept (used for the search phase).
 */
export function mergePlace(
  existing: Place | undefined,
  incoming: PlaceUpdate,
  preferExisting: boolean,
): Place {
  const base: Place = existing ?? { id: incoming.id, _mask_version: 0, updated_at: '' }
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(incoming)) {
    if (isEmpty(value)) continue
    if (preferExisting && !isEmpty(merged[key])) continue
    merged[key] = value
  }
  const place = merged as unknown as Place
  const { score, incomplete } = computeCompleteness(place)
  place._completeness = score
  place._incomplete = incomplete
  place.updated_at = new Date().toISOString()
  return place
}

export async function getAllPlaces(): Promise<Place[]> {
  return (await getDb()).getAll('places')
}

export async function getPlace(id: string) {
  return (await getDb()).get('places', id)
}

export async function putPlace(place: Place) {
  await (await getDb()).put('places', place)
}

export async function upsertPlace(incoming: PlaceUpdate, preferExisting = false) {
  const db = await getDb()
  const tx = db.transaction('places', 'readwrite')
  const existing = await tx.store.get(incoming.id)
  const merged = mergePlace(existing, incoming, preferExisting)
  await tx.store.put(merged)
  await tx.done
  return merged
}

export async function clearPlaces() {
  await (await getDb()).clear('places')
}

export async function recordFailure(id: string, lang: string, error: string) {
  const place = await getPlace(id)
  if (!place) return
  const failed = [...(place._failed ?? [])]
  const idx = failed.findIndex((f) => f.lang === lang)
  const now = new Date().toISOString()
  if (idx >= 0) failed[idx] = { ...failed[idx], tries: failed[idx].tries + 1, error, lastAt: now }
  else failed.push({ lang, tries: 1, error, lastAt: now })
  await putPlace({ ...place, _failed: failed })
}

export async function clearFailure(id: string, lang: string) {
  const place = await getPlace(id)
  if (!place?._failed?.length) return
  const failed = place._failed.filter((f) => f.lang !== lang)
  await putPlace({ ...place, _failed: failed.length ? failed : undefined })
}

export async function clearAllFailures() {
  const db = await getDb()
  const tx = db.transaction('places', 'readwrite')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if (cursor.value._failed?.length) {
      await cursor.update({ ...cursor.value, _failed: undefined })
    }
    cursor = await cursor.continue()
  }
  await tx.done
}
