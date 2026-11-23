export type Lang = 'en' | 'ar'

export type DeliveryCountry = 'QA' | 'SA'

export const DELIVERY_PLATFORMS = ['Talabat', 'Snoonu', 'Rafeek', 'Ninja', 'Keeta'] as const
export const DELIVERY_PLATFORMS_BY_COUNTRY = {
  QA: ['Talabat', 'Snoonu', 'Rafeek', 'Keeta'],
  SA: ['Talabat', 'Ninja'],
} as const
export const DISCOUNT_PLATFORMS = ['Urban Point', 'MyBook', 'Entertainer'] as const

export interface PlacePhoto {
  name: string
  widthPx: number
  heightPx: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authorAttribution: any
  photoUri?: string
}

export interface FailedEntry {
  lang: string
  tries: number
  error: string
  lastAt: string
}

export interface Place {
  id: string
  name_en?: string
  name_ar?: string
  editorial_summary?: string
  generative_summary?: string
  primary_type?: string
  primary_type_display?: string
  types?: string[]
  lat?: number
  lng?: number
  formatted_address?: string
  adr_format?: string
  addr_building?: string
  addr_street?: string
  addr_zone?: string
  addr_area?: string
  phone?: string
  phone_intl?: string
  website?: string
  google_maps_url?: string
  price_level?: string
  price_band?: string
  price_range?: string
  rating?: number
  user_rating_count?: number
  delivery_platforms?: string[]
  discount_platforms?: string[]
  talabat_listed?: boolean
  talabat_rating?: number
  talabat_offers?: string[]
  talabat_delivery_fee?: string | number
  talabat_min_order?: string | number
  talabat_source_url?: string
  source?: string
  source_url?: string
  hours?: string[]
  hours_json?: string
  outdoor_seating?: boolean | null
  takeout?: boolean | null
  delivery?: boolean | null
  dine_in?: boolean | null
  curbside_pickup?: boolean | null
  allows_dogs?: boolean | null
  good_for_children?: boolean | null
  good_for_groups?: boolean | null
  good_for_watching_sports?: boolean | null
  menu_for_children?: boolean | null
  restroom?: boolean | null
  serves_beer?: boolean | null
  serves_cocktails?: boolean | null
  serves_coffee?: boolean | null
  serves_dessert?: boolean | null
  serves_vegetarian?: boolean | null
  serves_wine?: boolean | null
  parking?: string
  payment?: string
  accessibility?: string
  business_status?: string
  photos?: PlacePhoto[]
  language?: Lang
  _mask_version: number
  _details_done?: boolean
  _completeness?: number
  _incomplete?: string[]
  _geo_building?: string
  _geo_street?: string
  _geo_zone?: string
  _geo_area?: string
  _geo_district?: string
  _geo_formatted?: string
  _geo_place_id?: string
  _geo_source?: string
  _geo_enriched_at?: string
  _failed?: FailedEntry[]
  updated_at: string
}

export type PlaceUpdate = Partial<Place> & { id: string }

export type LogLevel = 'ok' | 'warn' | 'err' | 'info'

export interface LogEntry {
  id: number
  ts: string
  level: LogLevel
  msg: string
}

export interface GeoResult {
  building?: string
  street?: string
  zone?: string
  area?: string
  district?: string
  formatted?: string
  placeId?: string
}
