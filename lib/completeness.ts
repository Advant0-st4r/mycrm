import type { Place } from './types'

const isBool = (v: unknown) => typeof v === 'boolean'

const CHECKS: Record<string, (p: Partial<Place>) => boolean> = {
  name_en: (p) => !!p.name_en,
  name_ar: (p) => !!p.name_ar,
  coords: (p) => typeof p.lat === 'number' && typeof p.lng === 'number',
  phone: (p) => !!(p.phone || p.phone_intl),
  hours: (p) => !!p.hours?.length,
  cuisine: (p) =>
    (!!p.primary_type && p.primary_type !== 'restaurant') ||
    !!p.types?.some((t) => t.endsWith('_restaurant')),
  price: (p) => !!(p.price_level || p.price_range),
  amenities_resolved: (p) =>
    [p.dine_in, p.takeout, p.delivery, p.outdoor_seating].some(isBool),
  operational: (p) => !!p.business_status,
  geo_building: (p) => !!(p._geo_building || p.addr_building),
  geo_zone: (p) => !!(p._geo_zone || p.addr_zone),
}

export function computeCompleteness(p: Partial<Place>) {
  const keys = Object.keys(CHECKS)
  const incomplete = keys.filter((k) => !CHECKS[k](p))
  const score = Math.round(((keys.length - incomplete.length) / keys.length) * 100)
  return { score, incomplete }
}
