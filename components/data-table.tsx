'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ActionButton, inputClass } from './action-button'
import { StepCard } from './step-card'
import { exportCsv, exportJson } from '@/lib/export'
import { updatePlaceFields } from '@/lib/db'
import { DELIVERY_PLATFORMS_BY_COUNTRY, DISCOUNT_PLATFORMS, type DeliveryCountry, type Place } from '@/lib/types'

const MAX_ROWS = 500

function matches(p: Place, q: string) {
  return [
    p.name_en, p.name_ar, p.primary_type_display, p.addr_area, p._geo_area,
    p._geo_zone, p.phone, p.formatted_address,
  ].some((v) => v?.toLowerCase().includes(q))
}

export function DataTable({
  places,
  onRefresh,
  deliveryCountry,
}: {
  places: Place[]
  onRefresh: () => void
  deliveryCountry: DeliveryCountry
}) {
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
              {['Name (EN)', 'Name (AR)', 'Cuisine', 'Area', 'Building', 'Phone', 'Price', 'Google rating', 'Availability', 'Complete', 'Coords'].map(
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
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  {places.length === 0
                    ? 'No places yet. Run a collection in Step 3.'
                    : 'No places match your search.'}
                </td>
              </tr>
            ) : (
              visible.map((p) => <Row key={p.id} place={p} onRefresh={onRefresh} deliveryCountry={deliveryCountry} />)
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

function Row({
  place: p,
  onRefresh,
  deliveryCountry,
}: {
  place: Place
  onRefresh: () => void
  deliveryCountry: DeliveryCountry
}) {
  const [expanded, setExpanded] = useState(false)
  const [deliveryPlatforms, setDeliveryPlatforms] = useState(p.delivery_platforms ?? [])
  const [discountPlatforms, setDiscountPlatforms] = useState(p.discount_platforms ?? [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pct = p._completeness ?? 0

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (expanded && !dialog.open) dialog.showModal()
    if (!expanded && dialog.open) dialog.close()
  }, [expanded])
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'

  async function updatePlatforms(field: 'delivery_platforms' | 'discount_platforms', platform: string, checked: boolean) {
    const selected = field === 'delivery_platforms' ? deliveryPlatforms : discountPlatforms
    const next = checked ? [...selected, platform] : selected.filter((item) => item !== platform)
    setSaving(true)
    setSaveError('')
    try {
      await updatePlaceFields(p.id, { [field]: next })
      if (field === 'delivery_platforms') setDeliveryPlatforms(next)
      else setDiscountPlatforms(next)
      onRefresh()
    } catch {
      setSaveError('Could not save this change. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedPlatforms = [...deliveryPlatforms, ...discountPlatforms]
  const editId = `platform-editor-${encodeURIComponent(p.id)}`

  return (
    <>
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
          {typeof p.rating === 'number' ? `${p.rating.toFixed(1)} (${p.user_rating_count ?? 0})` : '—'}
        </td>
        <td className="min-w-44 px-3 py-2">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-slate-300">
              {selectedPlatforms.length ? selectedPlatforms.join(', ') : 'No platforms selected'}
            </span>
            <button
              type="button"
              className="min-h-11 rounded-md text-sm font-medium text-sky-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              aria-expanded={expanded}
              aria-controls={editId}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Close editor' : 'Edit availability'}
            </button>
          </div>
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
      {typeof document !== 'undefined' &&
        createPortal(
          <dialog
            ref={dialogRef}
            id={editId}
            aria-labelledby={`${editId}-title`}
            onClose={() => setExpanded(false)}
            className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl backdrop:bg-black/70"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={`${editId}-title`} className="text-base font-semibold">
                Platform availability for {p.name_en ?? 'this restaurant'}
              </h2>
              <button
                type="button"
                autoFocus
                className="min-h-11 shrink-0 rounded-md px-3 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                onClick={() => setExpanded(false)}
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <PlatformOptions
                title="Delivery platforms"
                platforms={DELIVERY_PLATFORMS_BY_COUNTRY[deliveryCountry]}
                selected={deliveryPlatforms}
                disabled={saving}
                onChange={(platform, checked) => void updatePlatforms('delivery_platforms', platform, checked)}
              />
              <PlatformOptions
                title="Discount platforms"
                platforms={DISCOUNT_PLATFORMS}
                selected={discountPlatforms}
                disabled={saving}
                onChange={(platform, checked) => void updatePlatforms('discount_platforms', platform, checked)}
              />
              {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
            </div>
          </dialog>,
          document.body,
        )}
    </>
  )
}

function PlatformOptions({
  title,
  platforms,
  selected,
  disabled,
  onChange,
}: {
  title: string
  platforms: readonly string[]
  selected: string[]
  disabled: boolean
  onChange: (platform: string, checked: boolean) => void
}) {
  return (
    <fieldset className="flex flex-wrap gap-1">
      <legend className="mb-1 w-full text-xs font-medium text-slate-400">{title}</legend>
      {platforms.map((platform) => (
        <label key={platform} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-slate-200 hover:bg-slate-800/70">
          <input
            type="checkbox"
            checked={selected.includes(platform)}
            disabled={disabled}
            onChange={(event) => onChange(platform, event.target.checked)}
            className="size-5 accent-sky-400"
          />
          {platform}
        </label>
      ))}
    </fieldset>
  )
}
