'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ActionButton, inputClass } from './action-button'
import { StepCard } from './step-card'
import { exportCsv, exportJson } from '@/lib/export'
import { updatePlaceFields } from '@/lib/db'
import { DELIVERY_PLATFORMS_BY_COUNTRY, DISCOUNT_PLATFORMS, type DeliveryCountry, type Place } from '@/lib/types'
import {
  buildVerificationPrompt,
  normalizeRestaurantName,
  readPlatformFlags,
  selectedPlatformNames,
  stripJsonFences,
  type PlatformResultSnapshot,
  type VerificationRow,
} from '@/lib/platform-availability'

const MAX_ROWS = 500

function matches(place: Place, query: string) {
  return [
    place.name_en, place.name_ar, place.primary_type_display, place.addr_area, place._geo_area,
    place._geo_zone, place.phone, place.formatted_address,
  ].some((value) => value?.toLowerCase().includes(query))
}

export function DataTable({
  places,
  onRefresh,
  deliveryCountry,
  onPlatformsApplied,
}: {
  places: Place[]
  onRefresh: () => void
  deliveryCountry: DeliveryCountry
  onPlatformsApplied: (rows: PlatformResultSnapshot[]) => void
}) {
  const [query, setQuery] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [availabilityMessage, setAvailabilityMessage] = useState('')
  const [missingRows, setMissingRows] = useState<Place[]>([])
  const [applying, setApplying] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase()
    const list = search ? places.filter((place) => matches(place, search)) : places
    return [...list].sort((a, b) => (a.name_en ?? '').localeCompare(b.name_en ?? ''))
  }, [places, deferredQuery])

  const visible = filtered.slice(0, MAX_ROWS)
  const missingIds = useMemo(() => new Set(missingRows.map((place) => place.id)), [missingRows])

  async function copyPrompt(onlyMissing = false) {
    const rows = onlyMissing ? missingRows : filtered
    const indices = onlyMissing ? rows.map((place) => filtered.findIndex((item) => item.id === place.id)) : undefined
    try {
      await navigator.clipboard.writeText(buildVerificationPrompt(rows, indices))
      setAvailabilityMessage(onlyMissing ? `Copied a prompt for ${rows.length} remaining rows.` : `Copied a prompt for ${rows.length} rows.`)
    } catch {
      setAvailabilityMessage('Could not copy automatically. Select and copy the prompt from your browser settings.')
    }
  }

  async function applyResponse() {
    setAvailabilityMessage('')
    let response: unknown
    try {
      response = JSON.parse(stripJsonFences(aiResponse))
    } catch {
      setMissingRows(filtered)
      setAvailabilityMessage('That response is not valid JSON. Check it and try again.')
      return
    }

    if (!Array.isArray(response)) {
      setMissingRows(filtered)
      setAvailabilityMessage('The response needs to be a list of restaurant results.')
      return
    }

    const usedIndices = new Set<number>()
    const updates: Array<{ place: Place; snapshot: PlatformResultSnapshot; delivery: string[]; discounts: string[] }> = []

    for (const item of response) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const flags = readPlatformFlags(record)
      if (!flags || typeof record.restaurantName !== 'string' || !record.restaurantName.trim()) continue
      const name = record.restaurantName
      let index = Number.isInteger(record.rowIndex) && Number(record.rowIndex) >= 0 && Number(record.rowIndex) < filtered.length
        ? Number(record.rowIndex)
        : -1
      if (index >= 0 && name) {
        const place = filtered[index]
        const normalized = normalizeRestaurantName(name)
        const names = [place.name_en, place.name_ar, [place.name_en, place.name_ar].filter(Boolean).join(' | ')].filter((value): value is string => Boolean(value))
        if (!names.some((value) => normalizeRestaurantName(value) === normalized)) index = -1
      }
      if (index < 0 && name) {
        const normalized = normalizeRestaurantName(name)
        index = filtered.findIndex((place, rowIndex) => {
          if (usedIndices.has(rowIndex)) return false
          return [place.name_en, place.name_ar, [place.name_en, place.name_ar].filter(Boolean).join(' | ')].some((value) => value && normalizeRestaurantName(value) === normalized)
        })
      }
      if (index < 0 || usedIndices.has(index)) continue

      const place = filtered[index]
      const selected = selectedPlatformNames(flags)
      usedIndices.add(index)
      updates.push({
        place,
        delivery: selected.delivery,
        discounts: selected.discounts,
        snapshot: {
          rowIndex: index,
          placeId: place.id,
          restaurantName: name || place.name_en || place.name_ar || place.id,
          ...flags,
        },
      })
    }

    const unfilled = filtered.filter((_, index) => !usedIndices.has(index))
    setMissingRows(unfilled)
    setApplying(true)
    try {
      await Promise.all(updates.map(({ place, delivery, discounts }) =>
        updatePlaceFields(place.id, { delivery_platforms: delivery, discount_platforms: discounts }),
      ))
      if (updates.length) {
        onPlatformsApplied(updates.map(({ snapshot }) => snapshot))
        onRefresh()
      }
      setAvailabilityMessage(unfilled.length
        ? `${unfilled.length} rows still need platform info. You can copy a prompt for just those rows or edit them below.`
        : `All ${filtered.length} rows have platform information.`)
    } catch {
      setAvailabilityMessage('Some changes could not be saved. Try applying the response again.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <StepCard step={4} title="Review & export">
      <div className="flex flex-col gap-2 md:flex-row">
        <label htmlFor="table-search" className="sr-only">Search places</label>
        <input
          id="table-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, cuisine, area, phone…"
          className={`${inputClass} md:flex-1`}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton tone="primary" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>Export CSV</ActionButton>
          <ActionButton tone="primary" onClick={() => exportJson(filtered)} disabled={!filtered.length}>Export JSON</ActionButton>
          <ActionButton onClick={onRefresh}>Refresh</ActionButton>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4" aria-labelledby="availability-title">
        <div>
          <h3 id="availability-title" className="text-sm font-semibold text-slate-100">Check platform availability</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">Copy a prompt for the visible rows, ask Gemini to check current Qatar listings, then paste its JSON response here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => void copyPrompt()} disabled={!filtered.length}>Copy verification prompt</ActionButton>
          {missingRows.length > 0 && <ActionButton onClick={() => void copyPrompt(true)}>Copy prompt for remaining rows ({missingRows.length})</ActionButton>}
        </div>
        <label htmlFor="platform-ai-response" className="text-xs font-medium text-slate-300">Paste Gemini&apos;s response</label>
        <textarea
          id="platform-ai-response"
          rows={5}
          value={aiResponse}
          onChange={(event) => setAiResponse(event.target.value)}
          placeholder="Paste the full response here…"
          className={`${inputClass} resize-y font-mono text-xs`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton tone="success" onClick={() => void applyResponse()} disabled={!aiResponse.trim() || applying || !filtered.length}>
            {applying ? 'Applying…' : 'Apply to all rows'}
          </ActionButton>
          {availabilityMessage && <p role="status" aria-live="polite" className="text-sm text-slate-300">{availabilityMessage}</p>}
        </div>
      </section>

      <div className="max-h-96 overflow-auto rounded-lg border border-slate-700/60">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-800 text-slate-300">
            <tr>
              {['Name (EN)', 'Name (AR)', 'Cuisine', 'Area', 'Building', 'Phone', 'Price', 'Google rating', 'Availability', 'Complete', 'Coords'].map((heading) => (
                <th key={heading} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-500">{places.length === 0 ? 'No places yet. Run a collection in Step 3.' : 'No places match your search.'}</td></tr>
            ) : visible.map((place) => (
              <Row key={place.id} place={place} onRefresh={onRefresh} deliveryCountry={deliveryCountry} needsPlatformInfo={missingIds.has(place.id)} />
            ))}
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
  place,
  onRefresh,
  deliveryCountry,
  needsPlatformInfo,
}: {
  place: Place
  onRefresh: () => void
  deliveryCountry: DeliveryCountry
  needsPlatformInfo: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [deliveryPlatforms, setDeliveryPlatforms] = useState(place.delivery_platforms ?? [])
  const [discountPlatforms, setDiscountPlatforms] = useState(place.discount_platforms ?? [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pct = place._completeness ?? 0

  useEffect(() => {
    setDeliveryPlatforms(place.delivery_platforms ?? [])
    setDiscountPlatforms(place.discount_platforms ?? [])
  }, [place.delivery_platforms, place.discount_platforms])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (expanded && !dialog.open) dialog.showModal()
    if (!expanded && dialog.open) dialog.close()
  }, [expanded])

  const selectedPlatforms = [...deliveryPlatforms, ...discountPlatforms]
  const editId = `platform-editor-${encodeURIComponent(place.id)}`

  async function updatePlatforms(field: 'delivery_platforms' | 'discount_platforms', platform: string, checked: boolean) {
    const selected = field === 'delivery_platforms' ? deliveryPlatforms : discountPlatforms
    const next = checked ? [...selected, platform] : selected.filter((item) => item !== platform)
    setSaving(true)
    setSaveError('')
    try {
      await updatePlaceFields(place.id, { [field]: next })
      if (field === 'delivery_platforms') setDeliveryPlatforms(next)
      else setDiscountPlatforms(next)
      onRefresh()
    } catch {
      setSaveError('Could not save this change. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <>
      <tr className={`text-slate-200 hover:bg-slate-800/50 ${needsPlatformInfo ? 'bg-amber-950/30' : ''}`}>
        <td className="px-3 py-2 font-medium">
          {place.google_maps_url ? <a href={place.google_maps_url} target="_blank" rel="noreferrer" className="hover:text-sky-400 hover:underline">{place.name_en ?? '—'}</a> : (place.name_en ?? '—')}
        </td>
        <td className="px-3 py-2" dir="rtl" lang="ar">{place.name_ar ?? '—'}</td>
        <td className="px-3 py-2 text-slate-300">{place.primary_type_display ?? '—'}</td>
        <td className="px-3 py-2 text-slate-300">{place.addr_area ?? place._geo_area ?? '—'}</td>
        <td className="px-3 py-2 font-mono text-slate-300">{place._geo_building ?? place.addr_building ?? '—'}</td>
        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-300">{place.phone ?? '—'}</td>
        <td className="px-3 py-2 text-slate-300">{place.price_band ?? place.price_range ?? '—'}</td>
        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-300">{typeof place.rating === 'number' ? `${place.rating.toFixed(1)} (${place.user_rating_count ?? 0})` : '—'}</td>
        <td className="min-w-44 px-3 py-2">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-slate-300">{selectedPlatforms.length ? selectedPlatforms.join(' · ') : 'No platforms listed'}</span>
            {needsPlatformInfo && <span className="text-xs font-medium text-amber-300">Needs platform info</span>}
            <button type="button" className="min-h-11 rounded-md text-sm font-medium text-sky-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" aria-expanded={expanded} aria-controls={editId} onClick={() => setExpanded((current) => !current)}>
              {expanded ? 'Close editor' : 'Edit availability'}
            </button>
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2" title={place._incomplete?.length ? `Missing: ${place._incomplete.join(', ')}` : 'Complete'}>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${place.name_en ?? place.id} completeness`}>
              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono tabular-nums text-slate-300">{pct}%</span>
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-400">{typeof place.lat === 'number' && typeof place.lng === 'number' ? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : '—'}</td>
      </tr>
      {typeof document !== 'undefined' && createPortal(
        <dialog
          ref={dialogRef}
          id={editId}
          aria-labelledby={`${editId}-title`}
          onClose={() => setExpanded(false)}
          className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl backdrop:bg-black/70"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={`${editId}-title`} className="text-base font-semibold">Platform availability for {place.name_en ?? 'this restaurant'}</h2>
            <button type="button" className="min-h-11 shrink-0 rounded-md px-3 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => setExpanded(false)}>Close</button>
          </div>
          <div className="flex flex-col gap-4">
            <PlatformOptions title="Delivery platforms" platforms={DELIVERY_PLATFORMS_BY_COUNTRY[deliveryCountry]} selected={deliveryPlatforms} disabled={saving} onChange={(platform, checked) => void updatePlatforms('delivery_platforms', platform, checked)} />
            <PlatformOptions title="Discount platforms" platforms={DISCOUNT_PLATFORMS} selected={discountPlatforms} disabled={saving} onChange={(platform, checked) => void updatePlatforms('discount_platforms', platform, checked)} />
            {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
          </div>
        </dialog>, document.body,
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
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium text-slate-400">{title}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {platforms.map((platform) => {
          const active = selected.includes(platform)
          return <button
            key={platform}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(platform, !active)}
            className={`min-h-11 px-0.5 text-sm underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50 ${active ? 'font-semibold text-sky-300 underline' : 'text-slate-400 hover:text-slate-200'}`}
          >{platform}</button>
        })}
      </div>
    </fieldset>
  )
}
