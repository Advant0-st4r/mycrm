import type { Place } from './types'

export const CSV_COLUMNS = [
  'id', 'name_en', 'name_ar', 'editorial_summary', 'generative_summary', 'primary_type',
  'primary_type_display', 'addr_building', 'addr_street', 'addr_zone', 'addr_area',
  'formatted_address', 'adr_format', '_geo_building', '_geo_street', '_geo_zone', '_geo_area',
  '_geo_formatted', '_geo_source', '_geo_enriched_at', 'lat', 'lng', 'phone', 'phone_intl',
  'website', 'google_maps_url', 'price_level', 'price_band', 'price_range', 'rating',
  'user_rating_count', 'outdoor_seating', 'takeout', 'delivery', 'dine_in', 'curbside_pickup',
  'allows_dogs', 'good_for_children', 'good_for_groups', 'good_for_watching_sports',
  'menu_for_children', 'restroom', 'serves_beer', 'serves_cocktails', 'serves_coffee',
  'serves_dessert', 'serves_vegetarian', 'serves_wine', 'parking', 'payment', 'accessibility',
  'business_status', 'hours', 'types', 'language', '_completeness', '_incomplete',
  '_mask_version', 'updated_at',
] as const

function cell(value: unknown): string {
  let s: string
  if (value === undefined || value === null) s = ''
  else if (Array.isArray(value)) s = value.join(' | ')
  else s = String(value)
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv(places: Place[]) {
  const header = CSV_COLUMNS.map(cell).join(',')
  const rows = places.map((p) =>
    CSV_COLUMNS.map((c) => cell((p as unknown as Record<string, unknown>)[c])).join(','),
  )
  return [header, ...rows].join('\r\n')
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function download(content: string, mime: string, ext: string) {
  const blob = new Blob([ext === 'csv' ? '\uFEFF' + content : content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `krave-qatar-${timestamp()}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportCsv(places: Place[]) {
  download(toCsv(places), 'text/csv;charset=utf-8', 'csv')
}

export function exportJson(places: Place[]) {
  download(JSON.stringify(places, null, 2), 'application/json', 'json')
}
