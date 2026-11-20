import { ApiError, normalizePlace, photoUri, placeDetails, reverseGeocode, textSearch } from './api'
import { config } from './config'
import { clearFailure, getAllPlaces, getPlace, putPlace, recordFailure, upsertPlace } from './db'
import { DETAILS_FIELD_MASK_AR, FIELD_GROUPS, MASK_VERSION, detailsMask, searchMask, type FieldGroup } from './masks'
import type { Sku } from './pricing'
import type { GeoResult, Lang, LogLevel, Place, PlaceUpdate } from './types'

export interface RunOptions {
  apiKey: string
  queryTemplate: string
  areas: string[]
  langMode: 'both' | 'en'
  maxPerArea: number
  photosMeta: boolean
  photoUris: boolean
  geoEnrich: boolean
  reEnrich: boolean
}

export interface RunCallbacks {
  log: (msg: string, level?: LogLevel) => void
  progress: (pct: number, text: string) => void
  sku: (sku: Sku) => void
  error: () => void
  found: (count: number) => void
  /** Resolves when not paused. Called between every iteration. */
  checkpoint: () => Promise<void>
  dataChanged: () => void
}

const DETAILS_DELAY_MS = 200
const PAGINATION_DELAY_MS = 1500
const DETAILS_RATE_LIMIT_SLEEP_MS = 15_000
const GEO_RATE_LIMIT_SLEEP_MS = 30_000
const MAX_TRIES = 4
const RETRY_BASE_MS = 15_000

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const isRateLimited = (e: unknown) => e instanceof ApiError && e.rateLimited

async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  sleepMs: number,
  cb: RunCallbacks,
  label: string,
): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!isRateLimited(e)) throw e
    cb.log(`Rate limited on ${label}; sleeping ${sleepMs / 1000}s`, 'warn')
    await sleep(sleepMs)
    return fn()
  }
}

function geoUpdate(id: string, geo: GeoResult | null): PlaceUpdate {
  const now = new Date().toISOString()
  if (!geo) return { id, _geo_source: 'google-geocoding:zero_results', _geo_enriched_at: now }
  return {
    id,
    _geo_building: geo.building,
    _geo_street: geo.street,
    _geo_zone: geo.zone,
    _geo_area: geo.area,
    _geo_district: geo.district,
    _geo_formatted: geo.formatted,
    _geo_place_id: geo.placeId,
    _geo_source: 'google-geocoding',
    _geo_enriched_at: now,
  }
}

async function fetchDetails(opts: RunOptions, cb: RunCallbacks, place: Place, lang: Lang) {
  const groups: FieldGroup[] = opts.photosMeta
    ? FIELD_GROUPS
    : FIELD_GROUPS.filter((group) => group !== 'photos')
  const mask = lang === 'ar' ? DETAILS_FIELD_MASK_AR : detailsMask(groups).mask
  const raw = await withRateLimitRetry(
    () => placeDetails(opts.apiKey, place.id, lang, mask),
    DETAILS_RATE_LIMIT_SLEEP_MS,
    cb,
    `details ${place.id}`,
  )
  cb.sku('DETAILS_ENTERPRISE_ATMOSPHERE')
  return upsertPlace(normalizePlace(raw, lang), false)
}

async function fetchGeo(opts: RunOptions, cb: RunCallbacks, place: Place) {
  const geo = await withRateLimitRetry(
    () => reverseGeocode(opts.apiKey, place.lat!, place.lng!),
    GEO_RATE_LIMIT_SLEEP_MS,
    cb,
    `geocode ${place.id}`,
  )
  cb.sku('GEOCODING')
  return upsertPlace(geoUpdate(place.id, geo), false)
}

async function fetchPhotoUri(opts: RunOptions, cb: RunCallbacks, place: Place) {
  const first = place.photos?.[0]
  if (!first || first.photoUri) return
  const uri = await photoUri(opts.apiKey, first.name)
  cb.sku('PLACE_PHOTO')
  if (!uri) return
  const fresh = await getPlace(place.id)
  if (!fresh?.photos?.length) return
  const photos = [...fresh.photos]
  photos[0] = { ...photos[0], photoUri: uri }
  await putPlace({ ...fresh, photos })
}

/* ---------- Phase 1: Text Search ---------- */
async function phaseSearch(opts: RunOptions, cb: RunCallbacks) {
  const found = new Set<string>()
  const groups: FieldGroup[] = opts.photosMeta
    ? FIELD_GROUPS
    : FIELD_GROUPS.filter((group) => group !== 'photos')
  const mask = searchMask(groups).mask

  for (let i = 0; i < opts.areas.length; i++) {
    const area = opts.areas[i]
    const query = opts.queryTemplate.replace(/\{area\}/g, area)
    let pageToken: string | undefined
    let count = 0
    let page = 0

    do {
      await cb.checkpoint()
      try {
        const res = await withRateLimitRetry(
          () => textSearch(opts.apiKey, query, mask, pageToken),
          DETAILS_RATE_LIMIT_SLEEP_MS,
          cb,
          `search "${area}"`,
        )
        cb.sku('TEXT_SEARCH_PRO')
        page++
        for (const raw of res.places) {
          if (count >= opts.maxPerArea) break
          await upsertPlace(normalizePlace(raw, 'en'), true)
          found.add(raw.id)
          count++
        }
        pageToken = res.nextPageToken
        cb.found(found.size)
        cb.log(`"${query}" page ${page}: ${res.places.length} results (${count} for area)`, 'ok')
      } catch (e) {
        cb.error()
        cb.log(`Search failed for "${area}": ${errMsg(e)}`, 'err')
        break
      }
      cb.progress(
        ((i + Math.min(count / opts.maxPerArea, 1)) / opts.areas.length) * 30,
        `Phase 1 · Searching ${area} (${i + 1}/${opts.areas.length})`,
      )
      if (pageToken && count < opts.maxPerArea) await sleep(PAGINATION_DELAY_MS)
    } while (pageToken && count < opts.maxPerArea)
  }

  cb.dataChanged()
  cb.log(`Phase 1 complete: ${found.size} unique places found`, 'ok')
}

/* ---------- Phase 2: Place Details ---------- */
async function phaseDetails(opts: RunOptions, cb: RunCallbacks) {
  const all = await getAllPlaces()
  const targets = all.filter(
    (p) => !p._details_done || (opts.reEnrich && (p._mask_version ?? 0) < MASK_VERSION),
  )
  const langs: Lang[] = opts.langMode === 'both' ? ['en', 'ar'] : ['en']
  cb.log(`Phase 2: fetching details for ${targets.length} places (${langs.join('+')})`, 'info')

  for (let i = 0; i < targets.length; i++) {
    let place = targets[i]
    let enOk = false

    for (const lang of langs) {
      await cb.checkpoint()
      try {
        place = await fetchDetails(opts, cb, place, lang)
        await clearFailure(place.id, lang)
        if (lang === 'en') enOk = true
      } catch (e) {
        cb.error()
        await recordFailure(place.id, lang, errMsg(e))
        cb.log(`Details ${lang} failed for ${place.name_en ?? place.id}: ${errMsg(e)}`, 'err')
      }
      await sleep(DETAILS_DELAY_MS)
    }

    if (enOk) {
      const fresh = await getPlace(place.id)
      if (fresh) await putPlace({ ...fresh, _details_done: true, _mask_version: MASK_VERSION })

      if (opts.photoUris && fresh) {
        try {
          await fetchPhotoUri(opts, cb, fresh)
        } catch (e) {
          cb.log(`Photo URI failed for ${fresh.name_en ?? fresh.id}: ${errMsg(e)}`, 'warn')
        }
      }
    }

    cb.progress(
      30 + ((i + 1) / Math.max(targets.length, 1)) * 40,
      `Phase 2 · Details ${i + 1}/${targets.length}`,
    )
    if ((i + 1) % 25 === 0) cb.dataChanged()
  }

  cb.dataChanged()
  cb.log('Phase 2 complete', 'ok')
}

/* ---------- Phase 3: Reverse geocoding ---------- */
async function phaseGeocode(opts: RunOptions, cb: RunCallbacks) {
  const all = await getAllPlaces()
  const candidates = all.filter(
    (p) =>
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      !p._geo_building &&
      !p._geo_enriched_at,
  )
  const targets = candidates.slice(0, config.geocodingMaxPerRun)
  if (candidates.length > targets.length) {
    cb.log(
      `Geocoding capped at ${config.geocodingMaxPerRun}; ${candidates.length - targets.length} deferred to next run`,
      'warn',
    )
  }
  cb.log(`Phase 3: reverse geocoding ${targets.length} places`, 'info')

  for (let i = 0; i < targets.length; i++) {
    await cb.checkpoint()
    const place = targets[i]
    try {
      await fetchGeo(opts, cb, place)
      await clearFailure(place.id, 'geo')
    } catch (e) {
      cb.error()
      await recordFailure(place.id, 'geo', errMsg(e))
      cb.log(`Geocode failed for ${place.name_en ?? place.id}: ${errMsg(e)}`, 'err')
    }
    cb.progress(
      70 + ((i + 1) / Math.max(targets.length, 1)) * 25,
      `Phase 3 · Geocoding ${i + 1}/${targets.length}`,
    )
    if ((i + 1) % 25 === 0) cb.dataChanged()
    await sleep(config.geocodingDelayMs)
  }

  cb.dataChanged()
  cb.log('Phase 3 complete', 'ok')
}

export async function runCollection(opts: RunOptions, cb: RunCallbacks) {
  cb.progress(0, 'Phase 1 · Text Search')
  await phaseSearch(opts, cb)

  cb.progress(30, 'Phase 2 · Place Details')
  await phaseDetails(opts, cb)

  if (opts.geoEnrich) {
    cb.progress(70, 'Phase 3 · Reverse geocoding')
    await phaseGeocode(opts, cb)
  } else {
    cb.log('Phase 3 skipped (geocode enrichment off)', 'warn')
  }

  cb.progress(95, 'Phase 4 · Refreshing stats')
  cb.dataChanged()
  cb.progress(100, 'Collection complete')
  cb.log('Collection complete', 'ok')
}

/* ---------- Retry queue ---------- */
export async function runRetry(opts: RunOptions, cb: RunCallbacks) {
  const all = await getAllPlaces()
  const jobs = all.flatMap((p) => (p._failed ?? []).map((f) => ({ place: p, entry: f })))
  const eligible = jobs.filter((j) => j.entry.tries < MAX_TRIES)
  const exhausted = jobs.length - eligible.length
  if (exhausted) cb.log(`${exhausted} entries reached ${MAX_TRIES} tries and were skipped`, 'warn')
  if (!eligible.length) {
    cb.log('Retry queue is empty', 'info')
    cb.progress(100, 'Nothing to retry')
    return
  }
  cb.log(`Retrying ${eligible.length} failed calls`, 'info')

  for (let i = 0; i < eligible.length; i++) {
    await cb.checkpoint()
    const { place, entry } = eligible[i]
    const backoff = RETRY_BASE_MS * 2 ** (entry.tries - 1)
    const wait = new Date(entry.lastAt).getTime() + backoff - Date.now()
    if (wait > 0) {
      cb.log(`Backoff ${Math.ceil(wait / 1000)}s before retrying ${place.name_en ?? place.id}`, 'warn')
      await sleep(wait)
    }

    try {
      if (entry.lang === 'geo') {
        await fetchGeo(opts, cb, place)
      } else {
        await fetchDetails(opts, cb, place, entry.lang as Lang)
        if (entry.lang === 'en') {
          const fresh = await getPlace(place.id)
          if (fresh) await putPlace({ ...fresh, _details_done: true, _mask_version: MASK_VERSION })
        }
      }
      await clearFailure(place.id, entry.lang)
      cb.log(`Retry ok: ${place.name_en ?? place.id} (${entry.lang})`, 'ok')
    } catch (e) {
      cb.error()
      await recordFailure(place.id, entry.lang, errMsg(e))
      cb.log(`Retry failed: ${place.name_en ?? place.id} (${entry.lang}): ${errMsg(e)}`, 'err')
    }
    cb.progress(((i + 1) / eligible.length) * 100, `Retrying ${i + 1}/${eligible.length}`)
    await sleep(DETAILS_DELAY_MS)
  }
  cb.dataChanged()
  cb.log('Retry pass complete', 'ok')
}
