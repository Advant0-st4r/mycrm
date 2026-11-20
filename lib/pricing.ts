const { config } = require('./config')
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

export type Sku = 'TEXT_SEARCH' | 'DETAILS' | 'PLACE_PHOTO' | 'GEOCODING'

export const SKUS: Sku[] = ['TEXT_SEARCH', 'DETAILS', 'PLACE_PHOTO', 'GEOCODING']

export const SKU_LABELS: Record<Sku, string> = {
  TEXT_SEARCH: 'Text Search',
  DETAILS: 'Details',
  PLACE_PHOTO: 'Photos',
  GEOCODING: 'Geocoding',
}

export type Usage = Record<Sku, { count: number; usd: number }>

export const emptyUsage = (): Usage =>
  Object.fromEntries(SKUS.map((s) => [s, { count: 0, usd: 0 }])) as Usage

export const perCall = (pricePer1k: number) => {
  if (!Number.isFinite(pricePer1k) || pricePer1k < 0) throw new Error('pricePer1k invalid')
  return pricePer1k / 1000
}

export function totalUsd(usage: Usage) {
  return Math.round(SKUS.reduce((sum, s) => sum + usage[s].usd, 0) * 1e6) / 1e6
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


