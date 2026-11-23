import { NextResponse } from 'next/server'

const API_HOST = 'ninja-saudi-arabia.p.rapidapi.com'
const API_ORIGIN = `https://${API_HOST}`
const CACHE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 200
const cache = new Map<string, { expiresAt: number; body: unknown }>()

function errorResponse(status: number, error: string, detail?: unknown) {
  return NextResponse.json({ error, ...(detail === undefined ? {} : { detail }) }, { status })
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 1_000) }
  }
}

export async function GET(request: Request) {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    return errorResponse(503, 'Ninja API is not configured. Set RAPIDAPI_KEY on the server.')
  }

  const incoming = new URL(request.url)
  const path = incoming.searchParams.get('path')
  if (!path || path.length > 512 || !path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
    return errorResponse(400, 'Provide a valid Ninja API path beginning with /.')
  }

  let target: URL
  try {
    target = new URL(path, API_ORIGIN)
  } catch {
    return errorResponse(400, 'The Ninja API path is invalid.')
  }
  if (target.origin !== API_ORIGIN || target.hash) {
    return errorResponse(400, 'Only relative paths on the Ninja Saudi Arabia API are allowed.')
  }

  const forwarded: [string, string][] = []
  for (const [key, value] of incoming.searchParams) {
    if (key === 'path') continue
    if (key.length > 100 || value.length > 1_000 || forwarded.length >= 30) {
      return errorResponse(400, 'Query parameters exceed the allowed size.')
    }
    forwarded.push([key, value])
  }
  forwarded.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  )
  target.search = new URLSearchParams(forwarded).toString()

  const cacheKey = target.toString()
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } })
  }
  if (cached) cache.delete(cacheKey)

  try {
    const upstream = await fetch(target, {
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': apiKey,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    const body = readJson(await upstream.text())

    if (upstream.status === 429) {
      return NextResponse.json(
        { error: 'Ninja API rate limit reached. Wait before retrying.', detail: body },
        { status: 429, headers: upstream.headers.get('retry-after') ? { 'Retry-After': upstream.headers.get('retry-after')! } : undefined },
      )
    }
    if (!upstream.ok) {
      return errorResponse(upstream.status, `Ninja API returned HTTP ${upstream.status}.`, body)
    }

    if (cache.size >= MAX_CACHE_ENTRIES) {
      for (const [key, value] of cache) {
        if (value.expiresAt <= now) cache.delete(key)
      }
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string)
    }
    cache.set(cacheKey, { body, expiresAt: now + CACHE_TTL_MS })
    return NextResponse.json(body, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return errorResponse(504, 'The Ninja API request timed out after 15 seconds.')
    }
    return errorResponse(502, 'Could not reach the Ninja API. Try again shortly.')
  }
}
