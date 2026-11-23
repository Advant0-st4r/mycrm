'use client'

import { useState } from 'react'
import { ActionButton, inputClass } from './action-button'
import { Callout, StepCard } from './step-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DeliveryCountry, Place } from '@/lib/types'

interface DeliveryPlatformsProps {
  country: DeliveryCountry
  onCountryChange: (country: DeliveryCountry) => void
  onImportTalabat: (places: Place[]) => Promise<void>
}

type JsonRecord = Record<string, unknown>

export function DeliveryPlatforms({ country, onCountryChange, onImportTalabat }: DeliveryPlatformsProps) {
  const [path, setPath] = useState('')
  const [paramsText, setParamsText] = useState('{\n  "query": "restaurant name"\n}')
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  async function searchNinja(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPayload(null)

    let params: unknown
    try {
      params = JSON.parse(paramsText)
    } catch {
      setError('Query parameters must be valid JSON.')
      return
    }
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      setError('Query parameters must be a JSON object.')
      return
    }
    if (!path.trim()) {
      setError('Enter the Ninja endpoint path to search.')
      return
    }

    const requestUrl = new URL('/api/ninja', window.location.origin)
    requestUrl.searchParams.set('path', path.trim())
    for (const [key, value] of Object.entries(params as JsonRecord)) {
      if (value === null || value === undefined) continue
      if (Array.isArray(value)) {
        for (const item of value) requestUrl.searchParams.append(key, String(item))
      } else if (typeof value === 'object') {
        requestUrl.searchParams.set(key, JSON.stringify(value))
      } else {
        requestUrl.searchParams.set(key, String(value))
      }
    }

    setLoading(true)
    try {
      const response = await fetch(requestUrl, { headers: { accept: 'application/json' } })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = getMessage(result) || `Ninja request failed (${response.status}).`
        setError(message)
        return
      }
      setPayload(result)
    } catch {
      setError('Network error while contacting the Ninja proxy. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }

  async function importTalabatFile(file?: File) {
    setImportMessage('')
    if (!file) return
    setImporting(true)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const records = isRecord(parsed) && Array.isArray(parsed.places) ? parsed.places : null
      if (!records?.length) {
        throw new Error('This file has no places list. Use an area-run JSON file from the Talabat client.')
      }
      const places = records.filter(isPlaceImport)
      if (!places.length) throw new Error('No valid Talabat restaurant records were found in this file.')
      await onImportTalabat(places)
      setImportMessage(`Imported ${places.length.toLocaleString()} Talabat restaurants into this browser.`)
    } catch (cause) {
      setImportMessage(cause instanceof Error ? cause.message : 'Could not read this JSON file.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <StepCard title="Delivery platforms">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="delivery-country" className="text-sm font-medium text-slate-300">
            Delivery country
          </label>
          <select
            id="delivery-country"
            value={country}
            onChange={(event) => onCountryChange(event.target.value as DeliveryCountry)}
            className={`${inputClass} min-h-11 text-base`}
          >
            <option value="QA">Qatar</option>
            <option value="SA">Saudi Arabia</option>
          </select>
        </div>
        <p className="text-xs leading-5 text-slate-400" dir="auto">
          {country === 'QA'
            ? 'Talabat Qatar is the current seed source. Use the Python client to discover areas, scrape listings, then import its JSON output.'
            : 'Ninja is available for Saudi Arabia only. Requests are sent through the server-side RapidAPI proxy.'}
        </p>
      </div>

      {country === 'QA' ? (
        <TalabatImport
          importing={importing}
          message={importMessage}
          onFileChange={(file) => void importTalabatFile(file)}
        />
      ) : (
        <NinjaExplorer
          path={path}
          paramsText={paramsText}
          loading={loading}
          payload={payload}
          error={error}
          onPathChange={setPath}
          onParamsChange={setParamsText}
          onSubmit={(event) => void searchNinja(event)}
        />
      )}
    </StepCard>
  )
}

function TalabatImport({
  importing,
  message,
  onFileChange,
}: {
  importing: boolean
  message: string
  onFileChange: (file?: File) => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-700/60 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-slate-100">Talabat Qatar</h3>
        <p className="text-sm leading-6 text-slate-400" dir="auto">
          The batch client writes area results to JSON. Import an area-run file here to add its grouped restaurant rows to the current browser dataset.
        </p>
      </div>
      <Callout tone="sky">
        Discovery and area scraping are separate runs. The script defaults to a 20-row proof of concept and applies an estimated $0.50 row budget using the actor&apos;s $0.003-per-row price. The actor ignored its advertised hard-charge parameter in discovery, so enrichment may add cost beyond that estimate.
      </Callout>
      <div className="flex flex-col gap-2">
        <label htmlFor="talabat-json" className="text-sm font-medium text-slate-300">
          Import Talabat area JSON
        </label>
        <input
          id="talabat-json"
          type="file"
          accept="application/json,.json"
          disabled={importing}
          onChange={(event) => {
            onFileChange(event.target.files?.[0])
            event.currentTarget.value = ''
          }}
          className="min-h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-200 file:mr-3 file:min-h-8 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:text-sm file:text-slate-100"
        />
      </div>
      {importing && <p className="text-sm text-slate-400" aria-live="polite">Importing records…</p>}
      {message && <p className="text-sm text-slate-300" role="status">{message}</p>}
      <p className="text-xs text-slate-500">Imported rows are stored in IndexedDB in this browser, consistent with the existing collector.</p>
    </div>
  )
}

function NinjaExplorer({
  path,
  paramsText,
  loading,
  payload,
  error,
  onPathChange,
  onParamsChange,
  onSubmit,
}: {
  path: string
  paramsText: string
  loading: boolean
  payload: unknown
  error: string
  onPathChange: (path: string) => void
  onParamsChange: (params: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-700/60 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-slate-100">Ninja Saudi Arabia</h3>
        <p className="text-sm leading-6 text-slate-400" dir="auto">
          Enter an API endpoint and query object. Arabic response text is rendered with automatic direction detection.
        </p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="ninja-path" className="text-sm font-medium text-slate-300">Endpoint path</label>
          <input
            id="ninja-path"
            value={path}
            onChange={(event) => onPathChange(event.target.value)}
            placeholder="/path-from-RapidAPI-docs"
            autoComplete="off"
            className={`${inputClass} min-h-11 text-base`}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ninja-params" className="text-sm font-medium text-slate-300">Query parameters (JSON)</label>
          <textarea
            id="ninja-params"
            rows={3}
            value={paramsText}
            onChange={(event) => onParamsChange(event.target.value)}
            className={`${inputClass} min-h-24 resize-y font-mono text-base`}
            spellCheck={false}
          />
          <p className="text-xs text-slate-500">Use the parameter names documented by the Ninja Saudi Arabia API.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton tone="primary" type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Search Ninja'}
          </ActionButton>
          <span className="text-xs text-slate-500">Requests are cached in memory for 60 seconds.</span>
        </div>
      </form>

      {error && <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      {loading && <NinjaSkeletons />}
      {payload !== null && !loading && <NinjaResults payload={payload} />}
    </div>
  )
}

function NinjaSkeletons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading Ninja restaurants" aria-live="polite">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex flex-col gap-3 rounded-lg border border-slate-700/60 bg-slate-900 p-4">
          <Skeleton className="h-5 w-2/3 bg-slate-700" />
          <Skeleton className="h-4 w-full bg-slate-800" />
          <Skeleton className="h-4 w-1/2 bg-slate-800" />
        </div>
      ))}
    </div>
  )
}

function NinjaResults({ payload }: { payload: unknown }) {
  const rows = getRows(payload)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-200">Results</h4>
        <span className="text-xs text-slate-400">{rows.length.toLocaleString()} {rows.length === 1 ? 'record' : 'records'}</span>
      </div>
      {rows.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.slice(0, 50).map((row, index) => <NinjaResultCard key={getStableKey(row, index)} row={row} index={index} />)}
        </ul>
      ) : (
        <p className="rounded-md border border-slate-700/60 px-3 py-4 text-sm text-slate-400">The API returned JSON but no list of result records.</p>
      )}
      {rows.length > 50 && <p className="text-xs text-slate-500">Showing the first 50 records; the raw response contains the full payload.</p>}
      <details className="rounded-lg border border-slate-700/60 bg-slate-900">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-slate-300">View raw JSON</summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-700/60 p-3 text-xs leading-5 text-slate-300" dir="ltr">{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </div>
  )
}

function NinjaResultCard({ row, index }: { row: JsonRecord; index: number }) {
  const title = firstText(row, ['name', 'restaurantName', 'brandName', 'title', 'id']) || `Restaurant ${index + 1}`
  const url = firstHttpUrl(row, ['url', 'website', 'deepLink', 'link'])
  const fields = Object.entries(row)
    .flatMap(([key, value]) => {
      if (!isScalar(value) || ['name', 'restaurantName', 'brandName', 'title'].includes(key)) return []
      return [[key, value] as const]
    })
    .slice(0, 5)

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-700/60 bg-slate-900 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h5 className="truncate text-sm font-semibold text-slate-100" dir="auto">{title}</h5>
        {fields.length ? (
          <dl className="flex flex-col gap-2">
            {fields.map(([key, value]) => (
              <div key={key} className="flex min-w-0 items-start justify-between gap-3 border-t border-slate-800 pt-2 text-xs">
                <dt className="shrink-0 text-slate-500">{humanize(key)}</dt>
                <dd className="min-w-0 break-words text-right text-slate-300" dir="auto">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-xs text-slate-500">No additional fields.</p>}
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer" className="min-h-11 self-start py-3 text-xs font-medium text-sky-300 underline-offset-4 hover:underline">Open restaurant</a>}
    </li>
  )
}

function getRows(value: unknown, depth = 0): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value) || depth > 3) return []
  for (const key of ['restaurants', 'results', 'items', 'vendors', 'data']) {
    if (Array.isArray(value[key])) return (value[key] as unknown[]).filter(isRecord)
    if (value[key] && typeof value[key] === 'object') {
      const nestedRows = getRows(value[key], depth + 1)
      if (nestedRows.length) return nestedRows
    }
  }
  return []
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isPlaceImport(value: unknown): value is Place {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name_en === 'string'
}

function getMessage(value: unknown) {
  return isRecord(value) && typeof value.error === 'string' ? value.error : ''
}

function firstText(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (typeof row[key] === 'string' || typeof row[key] === 'number') return String(row[key])
  }
  return ''
}

function firstHttpUrl(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (typeof row[key] !== 'string') continue
    try {
      const url = new URL(row[key] as string)
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    } catch {
      continue
    }
  }
  return ''
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
}

function isScalar(value: unknown): value is string | number | boolean {
  return ['string', 'number', 'boolean'].includes(typeof value)
}

function formatValue(value: string | number | boolean) {
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
}

function getStableKey(row: JsonRecord, index: number) {
  return String(row.id ?? row.restaurantId ?? row.branchId ?? index)
}
