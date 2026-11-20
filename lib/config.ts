// NEXT_PUBLIC_* vars must be referenced literally so Next.js can inline them into the client bundle.
export const config = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  placesBase: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_BASE || 'https://places.googleapis.com/v1',
  geocodingBase:
    process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_BASE ||
    'https://maps.googleapis.com/maps/api/geocode/json',
  geocodingMaxPerRun: Number(process.env.NEXT_PUBLIC_GEOCODING_MAX_PER_RUN) || 2000,
  geocodingDelayMs: Number(process.env.NEXT_PUBLIC_GEOCODING_DELAY_MS) || 200,
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Krave Qatar Restaurant Data Collector',
  qarPerUsd: Number(process.env.NEXT_PUBLIC_CURRENCY_QR_TO_USD) || 3.64,
}

export const API_KEY_STORAGE = 'krave_gmaps_api_key'
