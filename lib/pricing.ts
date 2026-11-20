const { config } from './config'
const rate = config.qarPerUsd
if (!Number.isFinite(rate) || rate <= 0) throw new Error(...)

/** Places API (New) billing tiers — the highest-tier field in a mask sets the price of the call. */
export type Tier = 'essentials' | 'pro' | 'enterprise' | 'atmosphere'

export const TIER_ORDER: Tier[] = ['essentials', 'pro', 'enterprise', 'atmosphere']

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

export type Sku = 'TEXT_SEARCH' | 'DETAILS' | 'DETAILS_AR' | 'PLACE_PHOTO' | 'GEOCODING'

export const SKUS: Sku[] = ['TEXT_SEARCH', 'DETAILS', 'DETAILS_AR', 'PLACE_PHOTO', 'GEOCODING']

export const SKU_LABELS: Record<Sku, string> = {
  TEXT_SEARCH: 'Text Search',
  DETAILS: 'Details',
  DETAILS_AR: 'Arabic names',
  PLACE_PHOTO: 'Photos',
  GEOCODING: 'Geocoding',
}

export type Usage = Record<Sku, { count: number; usd: number }>

export const emptyUsage = (): Usage =>
  Object.fromEntries(SKUS.map((s) => [s, { count: 0, usd: 0 }])) as Usage

export const perCall = (pricePer1k: number) => pricePer1k / 1000

export function totalUsd(usage: Usage) {
  return SKUS.reduce((sum, s) => sum + usage[s].usd, 0)
}

export function maxTier(tiers: Tier[]): Tier {
  return tiers.reduce<Tier>(
    (top, t) => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(top) ? t : top),
    'essentials',
  )
}

export function usdToQar(usd: number) {
  return usd * config.qarPerUsd
}
