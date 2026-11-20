'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { ActionButton, inputClass } from './action-button'
import { StepCard } from './step-card'
import { exportCsv, exportJson } from '@/lib/export'
import type { Place } from '@/lib/types'

const MAX_ROWS = 500

function matches(p: Place, q: string) {
  return [
    p.name_en, p.name_ar, p.primary_type_display, p.addr_area, p._geo_area,
    p._geo_zone, p.phone, p.formatted_address,
  ].some((v) => v?.toLowerCase().includes(q))
}

export function DataTable({ places, onRefresh }: { places: Place[]; onRefresh: () => void }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const list = q ? places.filter((p) => matches(p, q)) : places
    return [...list].sort((a, b) => (a.name_en ?? '').localeCompare(b.name_en ?? ''))
  }, [places, deferredQuery])

  const visible = filtered.slice(0, MAX_ROWS)

  return (
    <StepCard step={4} title="Review & export">
      <div className="flex flex-col gap-2 md:flex-row">
        <label htmlFor="table-search" className="sr-only">
          Search places
        </label>
        <input
          id="table-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, cuisine, area, phone…"
          className={`${inputClass} md:flex-1`}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton tone="primary" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
            Export CSV
          </ActionButton>
          <ActionButton tone="primary" onClick={() => exportJson(filtered)} disabled={!filtered.length}>
            Export JSON
          </ActionButton>
          <ActionButton onClick={onRefresh}>Refresh</ActionButton>
        </div>
      </div>

      <div className="max-h-96 overflow-auto rounded-lg border border-slate-700/60">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-800 text-slate-300">
            <tr>
              {['Name (EN)', 'Name (AR)', 'Cuisine', 'Area', 'Building', 'Phone', 'Price', 'Rating', 'Complete', 'Coords'].map(
                (h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  {places.length === 0
                    ? 'No places yet. Run a collection in Step 3.'
                    : 'No places match your search.'}
                </td>
              </tr>
            ) : (
              visible.map((p) => <Row key={p.id} place={p} />)
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {filtered.length.toLocaleString()} rows
        {filtered.length !== places.length && ` (of ${places.length.toLocaleString()})`}
        {filtered.length > MAX_ROWS && ` · showing first ${MAX_ROWS}; exports include all matching rows`}
      </p>
    </StepCard>
  )
}

function Row({ place: p }: { place: Place }) {
  const pct = p._completeness ?? 0
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <tr className="text-slate-200 hover:bg-slate-800/50">
      <td className="px-3 py-2 font-medium">
        {p.google_maps_url ? (
          <a href={p.google_maps_url} target="_blank" rel="noreferrer" className="hover:text-sky-400 hover:underline">
            {p.name_en ?? '—'}
          </a>
        ) : (
          (p.name_en ?? '—')
        )}
      </td>
      <td className="px-3 py-2" dir="rtl" lang="ar">
        {p.name_ar ?? '—'}
      </td>
      <td className="px-3 py-2 text-slate-300">{p.primary_type_display ?? '—'}</td>
      <td className="px-3 py-2 text-slate-300">{p.addr_area ?? p._geo_area ?? '—'}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{p._geo_building ?? p.addr_building ?? '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-300">{p.phone ?? '—'}</td>
      <td className="px-3 py-2 text-slate-300">{p.price_band ?? p.price_range ?? '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-300">
        {p.rating ? `${p.rating.toFixed(1)} (${p.user_rating_count ?? 0})` : '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2" title={p._incomplete?.length ? `Missing: ${p._incomplete.join(', ')}` : 'Complete'}>
          <div
            className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${p.name_en ?? p.id} completeness`}
          >
            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono tabular-nums text-slate-300">{pct}%</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-400">
        {typeof p.lat === 'number' && typeof p.lng === 'number'
          ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
          : '—'}
      </td>
    </tr>
  )
}
