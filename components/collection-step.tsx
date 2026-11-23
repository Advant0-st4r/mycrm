'use client'

import { useEffect, useMemo, useState } from 'react'
import { ActionButton, inputClass } from './action-button'
import { LogPanel } from './log-panel'
import { StatCard } from './stat-card'
import { Callout, StepCard } from './step-card'
import type { RunOptions } from '@/lib/collector'
import { config } from '@/lib/config'
import { PRICES, SKU_LABELS, calcCost, skuCost, usdToQar, type Sku } from '@/lib/pricing'
import type { Place } from '@/lib/types'
import type { useCollector } from '@/hooks/use-collector'

const DEFAULT_AREAS = [
  'Doha', 'The Pearl Qatar', 'Lusail', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Mesaieed',
  'Umm Salal', 'Al Daayen', 'Doha Corniche', 'West Bay Doha', 'Souq Waqif',
  'Villaggio Mall Doha', 'Gate Mall Doha', 'Mirage Mall Doha',
].join('\n')

interface CollectionStepProps {
  apiKey: string
  places: Place[]
  collector: ReturnType<typeof useCollector>
}

export function CollectionStep({ apiKey, places, collector }: CollectionStepProps) {
  const [queryTemplate, setQueryTemplate] = useState('restaurants in {area}, Qatar')
  const [areasText, setAreasText] = useState(DEFAULT_AREAS)
  const [langMode, setLangMode] = useState<'both' | 'en'>('both')
  const [maxPerArea, setMaxPerArea] = useState(60)
  const [photosMeta, setPhotosMeta] = useState(true)
  const [photoUris, setPhotoUris] = useState(false)
  const [geoEnrich, setGeoEnrich] = useState(true)
  const [reEnrich, setReEnrich] = useState(true)
  const [pendingMode, setPendingMode] = useState<'collect' | 'retry' | null>(null)
  const [attemptsOpen, setAttemptsOpen] = useState(false)
  const { running, paused, progress, logs, sku, found, errors, attempts, clearAttempts } = collector
  const editable = !running || paused

  useEffect(() => { collector.loadAttempts() }, [collector.loadAttempts])

  const options = (): RunOptions => ({
    apiKey, queryTemplate,
    areas: areasText.split('\n').map((area) => area.trim()).filter(Boolean),
    langMode, maxPerArea, photosMeta, photoUris, geoEnrich, reEnrich,
  })

  const stats = useMemo(() => {
    const details = places.filter((place) => place._details_done).length
    const geo = places.filter((place) => place._geo_enriched_at).length
    const avg = places.length
      ? Math.round(places.reduce((sum, place) => sum + (place._completeness ?? 0), 0) / places.length)
      : 0
    return { details, geo, avg }
  }, [places])
  const costUsd = calcCost(sku)

  const beginConfirmation = (mode: 'collect' | 'retry') => {
    const requested = collector.requestStart(options(), mode)
    if (requested) setPendingMode(requested)
  }
  const confirmStart = () => {
    if (!pendingMode) return
    collector.confirmStart(options(), pendingMode)
    setPendingMode(null)
  }
  const confirmReset = () => {
    if (window.confirm('Delete all saved places from this browser? This cannot be undone.')) void collector.reset()
  }
  const confirmClearAttempts = () => {
    if (window.confirm('Delete saved attempt history and platform snapshots? Saved places will not be deleted. This cannot be undone.')) clearAttempts()
  }
  const download = (format: 'json' | 'csv') => {
    const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const content = format === 'json'
      ? JSON.stringify(attempts, null, 2)
      : [
          ['Attempt', 'Status', 'Saved at', 'Places found', 'Errors', 'Areas', 'Row index', 'Restaurant', 'Talabat', 'Snoonu', 'Rafeek', 'Keeta', 'Urban Point', 'MyBook', 'Entertainer'],
          ...attempts.flatMap((item) => item.platformRows?.length
            ? item.platformRows.map((row) => [item.attempt, item.status, item.savedAt, item.found, item.errors, item.areas, row.rowIndex, row.restaurantName, row.deliveryPlatforms.talabat, row.deliveryPlatforms.snoonu, row.deliveryPlatforms.rafeek, row.deliveryPlatforms.keeta, row.discountPlatforms.urban_point, row.discountPlatforms.mybook, row.discountPlatforms.entertainer])
            : [[item.attempt, item.status, item.savedAt, item.found, item.errors, item.areas, '', '', '', '', '', '', '', '', '']]),
        ].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = format === 'json' ? 'attempts.json' : 'attempts.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <StepCard step={3} title="Configure & run">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="query-template" className="text-sm font-medium text-slate-300">What to look for</label>
          <input id="query-template" value={queryTemplate} onChange={(event) => setQueryTemplate(event.target.value)} className={inputClass} disabled={!editable} />
          <p className="text-xs text-slate-500">{'{area}'} will be replaced with each area below.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="areas" className="text-sm font-medium text-slate-300">Areas (one per line)</label>
          <textarea id="areas" rows={6} value={areasText} onChange={(event) => setAreasText(event.target.value)} className={`${inputClass} resize-y text-xs`} disabled={!editable} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="lang-mode" className="text-xs font-medium text-slate-400">Language</label>
          <select id="lang-mode" value={langMode} onChange={(event) => setLangMode(event.target.value as 'both' | 'en')} className={`${inputClass} w-auto`} disabled={!editable}>
            <option value="both">English and Arabic</option><option value="en">English only</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="max-per-area" className="text-xs font-medium text-slate-400">Places per area</label>
          <select id="max-per-area" value={maxPerArea} onChange={(event) => setMaxPerArea(Number(event.target.value))} className={`${inputClass} w-auto`} disabled={!editable}>
            {[60, 40, 20].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </div>
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2" disabled={!editable}>
          <legend className="sr-only">Extra details</legend>
          <Check label="Include photo details" checked={photosMeta} onChange={setPhotosMeta} />
          <Check label="Include photo links" checked={photoUris} onChange={setPhotoUris} />
          <Check label="Add nearby address details" checked={geoEnrich} onChange={setGeoEnrich} />
          <Check label="Refresh older address details" checked={reEnrich} onChange={setReEnrich} />
        </fieldset>
      </div>

      <Callout>Address lookups are limited to {config.geocodingMaxPerRun.toLocaleString()} places per run.</Callout>

      {pendingMode && !running && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p>You cannot edit while this runs unless you pause. Confirm all and start?</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="success" onClick={confirmStart}>Confirm &amp; Start</ActionButton>
            <ActionButton onClick={() => setPendingMode(null)}>Go back</ActionButton>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!running && <>
          <ActionButton tone="success" onClick={() => beginConfirmation('collect')}>Review &amp; Start</ActionButton>
          <ActionButton tone="warn" onClick={() => beginConfirmation('retry')}>Retry saved issues</ActionButton>
          <ActionButton onClick={confirmReset}>Clear saved places</ActionButton>
        </>}
        {running && !paused && <>
          <ActionButton tone="warn" onClick={collector.togglePause}>Pause</ActionButton>
          <ActionButton tone="danger" onClick={collector.cancel}>Cancel</ActionButton>
        </>}
        {running && paused && <>
          <ActionButton tone="success" onClick={() => collector.updateAndResume(options())}>Save &amp; Resume</ActionButton>
          <ActionButton tone="danger" onClick={collector.cancel}>Cancel Run</ActionButton>
        </>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Run progress" aria-valuenow={Math.round(progress.pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-sky-400 transition-[width] duration-300" style={{ width: `${progress.pct}%` }} />
        </div>
        <p className="text-sm text-slate-400" aria-live="polite">{paused ? 'Paused' : running ? 'Running' : progress.text} · {Math.round(progress.pct)}%</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Found" value={found.toLocaleString()} tone="accent" />
        <StatCard label="Details" value={stats.details.toLocaleString()} />
        <StatCard label="Address details" value={stats.geo.toLocaleString()} />
        <StatCard label="Stored" value={places.length.toLocaleString()} tone="ok" />
        <StatCard label="Issues" value={errors.toLocaleString()} tone={errors ? 'err' : 'default'} />
        <StatCard label="Estimated cost" value={`$${costUsd.toFixed(2)}`} tone="warn" />
        <StatCard label="Complete" value={`${stats.avg}%`} />
      </dl>
      <p className="text-xs text-slate-400">{(Object.keys(PRICES) as Sku[]).map((item) => `${SKU_LABELS[item]}: ${sku[item]} ($${skuCost(item, sku[item]).toFixed(2)})`).join(' · ')}{' · '}<span className="text-amber-400">≈ {usdToQar(costUsd).toFixed(2)} QAR</span></p>

      <section className="rounded-xl border border-slate-800">
        <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-semibold text-slate-200" aria-expanded={attemptsOpen} onClick={() => setAttemptsOpen((open) => !open)}>
          <span>Saved Attempts ({attempts.length})</span><span aria-hidden="true">{attemptsOpen ? '−' : '+'}</span>
        </button>
        {attemptsOpen && <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => download('json')} disabled={!attempts.length}>Download JSON</ActionButton>
            <ActionButton onClick={() => download('csv')} disabled={!attempts.length}>Download CSV</ActionButton>
            <ActionButton tone="danger" onClick={confirmClearAttempts} disabled={!attempts.length}>Clear saved attempts</ActionButton>
          </div>
          {attempts.length === 0 ? <p className="text-sm text-slate-400">Your saved runs will appear here.</p> : (
            <ol className="flex flex-col gap-2">
              {[...attempts].reverse().map((item) => <li key={item.attempt} className="flex flex-col gap-1 rounded-lg bg-slate-900 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-slate-200">Attempt {item.attempt} · {item.status}</span>
                <span className="text-xs text-slate-400">{item.found} found · {item.areas} areas · {item.errors} issues · {new Date(item.savedAt).toLocaleString()}</span>
              </li>)}
            </ol>
          )}
        </div>}
      </section>
      <LogPanel logs={logs} />
    </StepCard>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-sky-400" />{label}</label>
}
