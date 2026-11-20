import { config } from './config'
import type { GeoResult, Lang, PlacePhoto, PlaceUpdate } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited = false,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function failFromResponse(res: Response): Promise<never> {
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json()
    message = body?.error?.message ?? message
  } catch {
    // non-JSON error body
  }
  throw new ApiError(message, res.status, res.status === 429)
}

export async function textSearch(
  apiKey: string,
  textQuery: string,
  fieldMask: string,
  pageToken?: string,
): Promise<{ places: Raw[]; nextPageToken?: string }> {
  const res = await fetch(`${config.placesBase}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'en',
      regionCode: 'QA',
      ...(pageToken ? { pageToken } : {}),
    }),
  })
  if (!res.ok) await failFromResponse(res)
  const data = await res.json()
  return { places: data.places ?? [], nextPageToken: data.nextPageToken }
}

export async function placeDetails(
  apiKey: string,
  id: string,
  lang: Lang,
  fieldMask: string,
): Promise<Raw> {
  const res = await fetch(
    `${config.placesBase}/places/${encodeURIComponent(id)}?languageCode=${lang}`,
    { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask } },
  )
  if (!res.ok) await failFromResponse(res)
  return res.json()
}

export async function reverseGeocode(
  apiKey: string,
  lat: number,
  lng: number,
): Promise<GeoResult | null> {
  const qs = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: apiKey,
    language: 'en',
    result_type: 'street_address|premise|subpremise|route',
  })
  const res = await fetch(`${config.geocodingBase}?${qs}`)
  if (!res.ok) await failFromResponse(res)
  const data = await res.json()
  if (data.status === 'ZERO_RESULTS') return null
  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new ApiError(data.error_message || 'OVER_QUERY_LIMIT', 429, true)
  }
  if (data.status !== 'OK') {
    throw new ApiError(data.error_message || data.status, 400)
  }
  return parseGeocode(data.results ?? [])
}

export function parseGeocode(results: Raw[]): GeoResult | null {
  if (!results.length) return null
  const pick = (types: string[]) => {
    for (const r of results) {
      for (const t of types) {
        const c = (r.address_components as Raw[] | undefined)?.find((c) => c.types?.includes(t))
        if (c) return c.long_name as string
      }
    }
    return undefined
  }
  return {
    building: pick(['street_number', 'premise']),
    street: pick(['route']),
    zone: pick(['neighborhood', 'sublocality_level_2']),
    area: pick(['sublocality_level_1', 'locality']),
    district: pick(['administrative_area_level_2', 'administrative_area_level_1']),
    formatted: results[0].formatted_address,
    placeId: results[0].place_id,
  }
}

export async function photoUri(apiKey: string, photoName: string): Promise<string | undefined> {
  const qs = new URLSearchParams({ maxHeightPx: '800', key: apiKey, skipHttpRedirect: 'true' })
  const res = await fetch(`${config.placesBase}/${photoName}/media?${qs}`, { redirect: 'follow' })
  if (!res.ok) await failFromResponse(res)
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const data = await res.json()
    return data.photoUri
  }
  return res.url
}

/* ---------- normalization ---------- */

const PRICE_BANDS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
}

function component(components: Raw[] | undefined, types: string[]) {
  if (!components) return undefined
  for (const t of types) {
    const c = components.find((c) => c.types?.includes(t))
    if (c) return (c.longText ?? c.long_name) as string
  }
  return undefined
}

const humanize = (key: string) => key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()

function trueKeys(obj?: Raw) {
  if (!obj) return undefined
  const keys = Object.entries(obj)
    .filter(([, v]) => v === true)
    .map(([k]) => humanize(k))
  return keys.length ? keys.join('; ') : undefined
}

const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)

function money(m?: Raw) {
  if (!m) return undefined
  return `${m.currencyCode ?? ''} ${m.units ?? 0}`.trim()
}

function priceRange(r?: Raw) {
  if (!r?.startPrice) return undefined
  const start = money(r.startPrice)
  return r.endPrice ? `${start}–${r.endPrice.units ?? ''}` : `${start}+`
}

export function normalizePlace(raw: Raw, lang: Lang): PlaceUpdate {
  if (lang === 'ar') {
    return { id: raw.id, name_ar: raw.displayName?.text }
  }
  const comps = raw.addressComponents as Raw[] | undefined
  const photos: PlacePhoto[] | undefined = (raw.photos as Raw[] | undefined)?.map((p) => ({
    name: p.name,
    widthPx: p.widthPx,
    heightPx: p.heightPx,
    authorAttribution: p.authorAttributions?.[0] ?? null,
  }))

  return {
    id: raw.id,
    name_en: raw.displayName?.text,
    editorial_summary: raw.editorialSummary?.text,
    generative_summary: raw.generativeSummary?.overview?.text,
    primary_type: raw.primaryType,
    primary_type_display: raw.primaryTypeDisplayName?.text,
    types: raw.types,
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    formatted_address: raw.formattedAddress,
    adr_format: raw.adrFormatAddress,
    addr_building: component(comps, ['street_number', 'premise']),
    addr_street: component(comps, ['route']),
    addr_zone: component(comps, ['neighborhood', 'sublocality_level_2']),
    addr_area: component(comps, ['sublocality_level_1', 'locality']),
    phone: raw.nationalPhoneNumber,
    phone_intl: raw.internationalPhoneNumber,
    website: raw.websiteUri,
    google_maps_url: raw.googleMapsUri,
    price_level: raw.priceLevel,
    price_band: raw.priceLevel ? PRICE_BANDS[raw.priceLevel] : undefined,
    price_range: priceRange(raw.priceRange),
    rating: raw.rating,
    user_rating_count: raw.userRatingCount,
    hours: raw.regularOpeningHours?.weekdayDescriptions,
    hours_json: raw.regularOpeningHours ? JSON.stringify(raw.regularOpeningHours) : undefined,
    outdoor_seating: bool(raw.outdoorSeating),
    takeout: bool(raw.takeout),
    delivery: bool(raw.delivery),
    dine_in: bool(raw.dineIn),
    curbside_pickup: bool(raw.curbsidePickup),
    allows_dogs: bool(raw.allowsDogs),
    good_for_children: bool(raw.goodForChildren),
    good_for_groups: bool(raw.goodForGroups),
    good_for_watching_sports: bool(raw.goodForWatchingSports),
    menu_for_children: bool(raw.menuForChildren),
    restroom: bool(raw.restroom),
    serves_beer: bool(raw.servesBeer),
    serves_cocktails: bool(raw.servesCocktails),
    serves_coffee: bool(raw.servesCoffee),
    serves_dessert: bool(raw.servesDessert),
    serves_vegetarian: bool(raw.servesVegetarianFood),
    serves_wine: bool(raw.servesWine),
    parking: trueKeys(raw.parkingOptions),
    payment: trueKeys(raw.paymentOptions),
    accessibility: trueKeys(raw.accessibilityOptions),
    business_status: raw.businessStatus,
    photos,
    language: 'en',
  }
}
