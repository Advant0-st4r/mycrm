import type { Place } from './types'

export const DELIVERY_KEYS = ['talabat', 'snoonu', 'rafeek', 'keeta', 'ninja'] as const
export const DISCOUNT_KEYS = ['urban_point', 'mybook', 'entertainer'] as const
export type DeliveryKey = (typeof DELIVERY_KEYS)[number]
export type DiscountKey = (typeof DISCOUNT_KEYS)[number]
export type PlatformFlags = {
  deliveryPlatforms: Record<DeliveryKey, boolean>
  discountPlatforms: Record<DiscountKey, boolean>
}
export type PlatformResultSnapshot = PlatformFlags & {
  rowIndex: number
  placeId: string
  restaurantName: string
}
export type VerificationRow = Pick<Place, 'id' | 'name_en' | 'name_ar' | 'addr_area' | '_geo_area' | 'addr_zone'>

export function normalizeRestaurantName(name: string) {
  return name.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

export function buildVerificationPrompt(places: VerificationRow[], rowIndices?: number[]) {
  const input = places.map((place, index) => ({
    rowIndex: rowIndices?.[index] ?? index,
    restaurantName: [place.name_en, place.name_ar].filter(Boolean).join(' | '),
    nameEnglish: place.name_en ?? '',
    nameArabic: place.name_ar ?? '',
    areaOrBranch: place.addr_area ?? place._geo_area ?? place.addr_zone ?? '',
  }))

  return `Do a simple live Google/Gemini web search for EACH restaurant below to check delivery-app listings. Search each restaurant separately by its English and Arabic name, adding its branch or area when available. Use a query like: "Abo Shariha" (site:talabat.com OR site:snoonu.com OR site:keeta.com OR site:rafeeq.com OR site:ninja.sa). Treat Ninja as applicable only for Saudi Arabia.\n\nCheck these delivery platforms: talabat, snoonu, rafeek (Rafeeq), keeta, and ninja (Saudi Arabia only). Also check discounts: urban_point (Urban Point), mybook (MyBook Qatar), and entertainer (The ENTERTAINER Qatar).\n\nRules:\n1. Search every input restaurant individually; do not infer from another branch or a similar restaurant name.\n2. Mark a platform true only when a matching active listing is found; otherwise mark it false.\n3. Return ONLY valid JSON matching the schema below: no markdown fences, commentary, or extra text.\n4. Include every input row in the same order and keep its rowIndex exactly as provided. Never omit a row.\n5. Every boolean must be explicitly true or false. Copy restaurantName exactly from the input row.\n\nRequired output schema:\n[{"rowIndex":0,"restaurantName":"Restaurant name","deliveryPlatforms":{"talabat":false,"snoonu":false,"rafeek":false,"keeta":false,"ninja":false},"discountPlatforms":{"urban_point":false,"mybook":false,"entertainer":false}}]\n\nInput restaurant list:\n${JSON.stringify(input, null, 2)}`
}

export function stripJsonFences(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fenced?.[1].trim() ?? value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJsonText(value: string): unknown {
  const candidates = [stripJsonFences(value)]
  const fencedBlocks = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  candidates.unshift(...fencedBlocks.map((match) => match[1].trim()))

  for (const candidate of candidates) {
    try { return JSON.parse(candidate) } catch { /* Try extracting the result from surrounding text. */ }
  }

  const starts = [...value.matchAll(/[\[{]/g)].slice(0, 20)
  for (const start of starts) {
    const first = start.index!
    const stack: string[] = []
    let inString = false
    let escaped = false
    for (let index = first; index < value.length; index++) {
      const char = value[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === '{' || char === '[') stack.push(char)
      else if (char === '}' || char === ']') {
        const opener = stack.pop()
        if ((char === '}' && opener !== '{') || (char === ']' && opener !== '[')) break
        if (stack.length === 0) {
          try { return JSON.parse(value.slice(first, index + 1)) } catch { break }
        }
      }
    }
  }
  throw new Error('No readable result list found')
}

export function parsePlatformResponse(value: string): unknown[] {
  const parsed = parseJsonText(value)
  if (Array.isArray(parsed)) return parsed
  if (!parsed || typeof parsed !== 'object') throw new Error('No restaurant results found')

  const record = parsed as Record<string, unknown>
  for (const key of ['results', 'result', 'restaurants', 'places', 'availability', 'data', 'items']) {
    const nested = record[key]
    if (Array.isArray(nested)) return nested
    if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>
      if (['restaurantName', 'restaurant_name', 'restaurant', 'name', 'placeId', 'place_id', 'rowIndex'].some((nameKey) => nameKey in nestedRecord)) return [nested]
      const values = Object.values(nestedRecord)
      if (values.length && values.every((item) => item && typeof item === 'object')) return values
    }
  }
  if (['restaurantName', 'restaurant_name', 'restaurant', 'name', 'placeId', 'place_id', 'rowIndex'].some((key) => key in record)) return [record]
  throw new Error('No restaurant results found')
}

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '')

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 0) return value === 1
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase().replace(/[ _-]+/g, ' ')
  if (['true', 'yes', 'y', '1', 'available', 'listed', 'active', 'found', 'on'].includes(normalized)) return true
  if (['false', 'no', 'n', '0', 'unavailable', 'not available', 'not listed', 'inactive', 'not found', 'off'].includes(normalized)) return false
  return undefined
}

function findPlatformValue(source: unknown, aliases: string[]): boolean | undefined {
  const keys = new Set(aliases.map(normalizeKey))
  if (Array.isArray(source)) return source.some((value) => typeof value === 'string' && keys.has(normalizeKey(value)))
  if (!source || typeof source !== 'object') return undefined
  const values = source as Record<string, unknown>
  for (const [key, value] of Object.entries(values)) {
    if (keys.has(normalizeKey(key))) {
      const normalized = booleanValue(value)
      if (normalized !== undefined) return normalized
    }
  }
  return undefined
}

export function readPlatformFlags(value: unknown): (PlatformFlags & { missingCount: number }) | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const platformRoot = row.platforms ?? row.availability ?? row
  const rootRecord = platformRoot && typeof platformRoot === 'object' ? platformRoot as Record<string, unknown> : undefined
  const delivery = row.deliveryPlatforms ?? row.delivery_platforms ?? row.delivery ?? rootRecord?.deliveryPlatforms ?? rootRecord?.delivery ?? platformRoot
  const discounts = row.discountPlatforms ?? row.discount_platforms ?? row.discounts ?? row.offers ?? rootRecord?.discountPlatforms ?? rootRecord?.discounts ?? rootRecord?.offers ?? platformRoot
  const deliveryAliases: Record<DeliveryKey, string[]> = {
    talabat: ['talabat'], snoonu: ['snoonu'], rafeek: ['rafeek', 'rafeeq'], keeta: ['keeta'], ninja: ['ninja'],
  }
  const discountAliases: Record<DiscountKey, string[]> = {
    urban_point: ['urban_point', 'urban point', 'urbanpoint'], mybook: ['mybook'], entertainer: ['entertainer'],
  }
  const deliveryValues = Object.fromEntries(DELIVERY_KEYS.map((key) => [key, findPlatformValue(delivery, deliveryAliases[key])])) as Record<DeliveryKey, boolean | undefined>
  const discountValues = Object.fromEntries(DISCOUNT_KEYS.map((key) => [key, findPlatformValue(discounts, discountAliases[key])])) as Record<DiscountKey, boolean | undefined>
  const allValues = [...Object.values(deliveryValues), ...Object.values(discountValues)]
  if (allValues.every((flag) => flag === undefined)) return null

  const missingCount = allValues.filter((flag) => flag === undefined).length
  return {
    deliveryPlatforms: Object.fromEntries(DELIVERY_KEYS.map((key) => [key, deliveryValues[key] ?? false])) as PlatformFlags['deliveryPlatforms'],
    discountPlatforms: Object.fromEntries(DISCOUNT_KEYS.map((key) => [key, discountValues[key] ?? false])) as PlatformFlags['discountPlatforms'],
    missingCount,
  }
}

export function selectedPlatformNames(flags: PlatformFlags) {
  const deliveryNames: Record<DeliveryKey, string> = { talabat: 'Talabat', snoonu: 'Snoonu', rafeek: 'Rafeek', keeta: 'Keeta', ninja: 'Ninja' }
  const discountNames: Record<DiscountKey, string> = { urban_point: 'Urban Point', mybook: 'MyBook', entertainer: 'Entertainer' }
  return {
    delivery: DELIVERY_KEYS.filter((key) => flags.deliveryPlatforms[key]).map((key) => deliveryNames[key]),
    discounts: DISCOUNT_KEYS.filter((key) => flags.discountPlatforms[key]).map((key) => discountNames[key]),
  }
}
