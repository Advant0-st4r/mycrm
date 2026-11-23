import type { Place } from './types'

export const DELIVERY_KEYS = ['talabat', 'snoonu', 'rafeek', 'keeta'] as const
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

  return `Verify Qatar platform availability for every restaurant in the input list below using live web search. Check English and Arabic names plus branch or area context.\n\nPlatforms to verify for EVERY row:\n- Delivery: talabat, snoonu, rafeek (Rafeeq), keeta\n- Discounts: urban_point (Urban Point), mybook (MyBook Qatar), entertainer (The ENTERTAINER Qatar)\n\nRules:\n1. Return ONLY valid JSON matching the schema below: no markdown fences, commentary, or extra text.\n2. Include every input row in the same order and keep its rowIndex exactly as provided. Never omit a row.\n3. Set a platform to true only when confirmed active in Qatar for that restaurant or branch; otherwise set it to false.\n4. Every boolean must be explicitly true or false.\n5. Copy restaurantName exactly from the input row.\n\nRequired output schema:\n[{"rowIndex":0,"restaurantName":"Restaurant name","deliveryPlatforms":{"talabat":false,"snoonu":false,"rafeek":false,"keeta":false},"discountPlatforms":{"urban_point":false,"mybook":false,"entertainer":false}}]\n\nInput restaurant list:\n${JSON.stringify(input, null, 2)}`
}

export function stripJsonFences(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export function readPlatformFlags(value: unknown): PlatformFlags | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const delivery = row.deliveryPlatforms
  const discounts = row.discountPlatforms
  if (!delivery || typeof delivery !== 'object' || !discounts || typeof discounts !== 'object') return null
  const deliveryFlags = delivery as Record<string, unknown>
  const discountFlags = discounts as Record<string, unknown>
  if (!DELIVERY_KEYS.every((key) => typeof deliveryFlags[key] === 'boolean')) return null
  if (!DISCOUNT_KEYS.every((key) => typeof discountFlags[key] === 'boolean')) return null
  return {
    deliveryPlatforms: Object.fromEntries(DELIVERY_KEYS.map((key) => [key, deliveryFlags[key]])) as PlatformFlags['deliveryPlatforms'],
    discountPlatforms: Object.fromEntries(DISCOUNT_KEYS.map((key) => [key, discountFlags[key]])) as PlatformFlags['discountPlatforms'],
  }
}

export function selectedPlatformNames(flags: PlatformFlags) {
  const deliveryNames: Record<DeliveryKey, string> = { talabat: 'Talabat', snoonu: 'Snoonu', rafeek: 'Rafeek', keeta: 'Keeta' }
  const discountNames: Record<DiscountKey, string> = { urban_point: 'Urban Point', mybook: 'MyBook', entertainer: 'Entertainer' }
  return {
    delivery: DELIVERY_KEYS.filter((key) => flags.deliveryPlatforms[key]).map((key) => deliveryNames[key]),
    discounts: DISCOUNT_KEYS.filter((key) => flags.discountPlatforms[key]).map((key) => discountNames[key]),
  }
}
