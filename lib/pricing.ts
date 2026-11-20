import { config } from './config'

const rate = config.qarPerUsd
if (!Number.isFinite(rate) || rate <= 0) {
  throw new Error('rate must be a finite number greater than 0')
}
/** Places API (New) billing tiers — the highest-tier field in a mask sets the price of the call. */
export type Tier = 'essentials' | 'pro' | 'enterprise' | 'atmosphere'

export const TIER_ORDER: Tier[] = ['essentials', 'pro', 'enterprise', 'atmosphere']

const _tierCheck: Record<Tier, true> = Object.fromEntries(TIER_ORDER.map(t => [t, true])) as Record<Tier, true>

export const TIER_LABELS: Record<Tier, string> = {
  essentials: 'Essentials',
  pro: 'Pro',
  enterprise: 'Enterprise',
  atmosphere: 'Enterprise + Atmosphere',
}

/** USD per 1,000 calls */
export const TEXT_SEARCH_PRICE: Record<Tier, number> = {
  essentials: 32,
  pro: 32,
  enterprise: 35,
  atmosphere: 40,
}

export const DETAILS_PRICE: Record<Tier, number> = {
  essentials: 5,
  pro: 17,
  enterprise: 20,
  atmosphere: 25,
}

export const PHOTO_PRICE = 7
export const GEOCODING_PRICE = 5

export type Sku = 'TEXT_SEARCH_PRO' | 'DETAILS_ENTERPRISE_ATMOSPHERE' | 'PLACE_PHOTO' | 'GEOCODING'

export const SKUS: Sku[] = ['TEXT_SEARCH_PRO', 'DETAILS_ENTERPRISE_ATMOSPHERE', 'PLACE_PHOTO', 'GEOCODING']

export const SKU_LABELS: Record<Sku, string> = {
  TEXT_SEARCH_PRO: 'Text Search (Pro)',
  DETAILS_ENTERPRISE_ATMOSPHERE: 'Details (Enterprise + Atmosphere)',
  PLACE_PHOTO: 'Photos',
  GEOCODING: 'Geocoding',
}

export const PRICES: Record<Sku, number> = {
  TEXT_SEARCH_PRO: TEXT_SEARCH_PRICE.pro,
  DETAILS_ENTERPRISE_ATMOSPHERE: DETAILS_PRICE.atmosphere,
  PLACE_PHOTO: PHOTO_PRICE,
  GEOCODING: GEOCODING_PRICE,
}

export type SkuCounts = Record<Sku, number>
export type Usage = Record<Sku, { count: number; usd: number }>

export const emptySkuCounts = (): SkuCounts =>
  Object.fromEntries(SKUS.map((sku) => [sku, 0])) as SkuCounts

export const emptyUsage = (): Usage =>
  Object.fromEntries(SKUS.map((sku) => [sku, { count: 0, usd: 0 }])) as Usage

export const perCall = (pricePer1k: number) => {
  if (!Number.isFinite(pricePer1k) || pricePer1k < 0) throw new Error('pricePer1k invalid')
  return pricePer1k / 1000
}

export const skuCost = (sku: Sku, count: number) => perCall(PRICES[sku]) * count

export function calcCost(counts: SkuCounts) {
  return Math.round(SKUS.reduce((sum, sku) => sum + skuCost(sku, counts[sku]), 0) * 1e6) / 1e6
}

export function totalUsd(usage: Usage) {
  return Math.round(SKUS.reduce((sum, sku) => sum + usage[sku].usd, 0) * 1e6) / 1e6
}

const skuCheck = new Set<Sku>(SKUS)

export function maxTier(tiers: Tier[]): Tier {
  if (tiers.length === 0) throw new Error('maxTier: no tiers')
  if (!tiers.every((t) => _tierCheck[t])) throw new Error('Invalid tier')

  return tiers.reduce<Tier>(
    (top, t) => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(top) ? t : top),
    'essentials',
  )
}

export function usdToQar(usd: number) {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('Invalid USD amount')
  return usd * config.qarPerUsd
}


