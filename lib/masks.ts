import { maxTier, type Tier } from './pricing'

export const MASK_VERSION = 2

export type FieldGroup =
  | 'identity'
  | 'location'
  | 'contact'
  | 'hours'
  | 'ratings'
  | 'pricing'
  | 'amenities'
  | 'summaries'
  | 'photos'

export const FIELD_GROUPS: FieldGroup[] = [
  'identity',
  'location',
  'contact',
  'hours',
  'ratings',
  'pricing',
  'amenities',
  'summaries',
  'photos',
]

/** Always requested: without them a row is not identifiable or mappable. */
export const LOCKED_GROUPS: FieldGroup[] = ['identity', 'location']

interface GroupDef {
  label: string
  description: string
  tier: Tier
  fields: string[]
  /** Fields not accepted by Text Search, only by Place Details. */
  detailsOnly?: string[]
}

export const GROUP_DEFS: Record<FieldGroup, GroupDef> = {
  identity: {
    label: 'Identity',
    description: 'Name, category, status, Maps link',
    tier: 'pro',
    fields: [
      'displayName',
      'primaryType',
      'primaryTypeDisplayName',
      'types',
      'businessStatus',
      'googleMapsUri',
      'pureServiceAreaBusiness',
    ],
  },
  location: {
    label: 'Location',
    description: 'Coordinates and structured address',
    tier: 'essentials',
    fields: ['location', 'formattedAddress', 'addressComponents', 'adrFormatAddress'],
  },
  contact: {
    label: 'Contact',
    description: 'Phone numbers and website',
    tier: 'enterprise',
    fields: ['nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri'],
  },
  hours: {
    label: 'Opening hours',
    description: 'Regular and current hours',
    tier: 'enterprise',
    fields: ['regularOpeningHours', 'currentOpeningHours', 'utcOffsetMinutes'],
  },
  ratings: {
    label: 'Ratings',
    description: 'Star rating and review count',
    tier: 'enterprise',
    fields: ['rating', 'userRatingCount'],
  },
  pricing: {
    label: 'Pricing',
    description: 'Price level and price range',
    tier: 'enterprise',
    fields: ['priceLevel', 'priceRange'],
  },
  amenities: {
    label: 'Amenities',
    description: 'Dine-in, delivery, parking, payment, accessibility…',
    tier: 'atmosphere',
    fields: [
      'outdoorSeating',
      'takeout',
      'delivery',
      'dineIn',
      'curbsidePickup',
      'allowsDogs',
      'goodForChildren',
      'goodForGroups',
      'goodForWatchingSports',
      'menuForChildren',
      'restroom',
      'servesBeer',
      'servesCocktails',
      'servesCoffee',
      'servesDessert',
      'servesVegetarianFood',
      'servesWine',
      'paymentOptions',
      'parkingOptions',
      'accessibilityOptions',
    ],
  },
  summaries: {
    label: 'Summaries',
    description: 'Editorial, AI and review summaries',
    tier: 'atmosphere',
    fields: ['editorialSummary', 'generativeSummary', 'reviewSummary'],
    detailsOnly: ['reviewSummary'],
  },
  photos: {
    label: 'Photo metadata',
    description: 'Photo references and attributions',
    tier: 'essentials',
    fields: ['photos'],
  },
}

export interface Mask {
  mask: string
  tier: Tier
}

function withLocked(groups: FieldGroup[]) {
  return [...new Set<FieldGroup>([...LOCKED_GROUPS, ...groups])]
}

export function detailsMask(groups: FieldGroup[]): Mask {
  const all = withLocked(groups)
  return {
    mask: ['id', ...all.flatMap((g) => GROUP_DEFS[g].fields)].join(','),
    tier: maxTier(all.map((g) => GROUP_DEFS[g].tier)),
  }
}

export function searchMask(groups: FieldGroup[]): Mask {
  const all = withLocked(groups)
  const fields = all.flatMap((g) => {
    const skip = new Set(GROUP_DEFS[g].detailsOnly ?? [])
    return GROUP_DEFS[g].fields.filter((f) => !skip.has(f))
  })
  return {
    mask: ['places.id', ...fields.map((f) => `places.${f}`), 'nextPageToken'].join(','),
    tier: maxTier(all.map((g) => GROUP_DEFS[g].tier)),
  }
}

/** Arabic pass only needs the localized name; everything else comes from the English pass. */
export const DETAILS_FIELD_MASK_AR = 'id,displayName'
export const DETAILS_AR_TIER: Tier = 'pro'
