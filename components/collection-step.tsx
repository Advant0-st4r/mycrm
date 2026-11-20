'use client'

import { useMemo, useState } from 'react'
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

  const { running, paused, progress, logs, sku, found, errors } = collector

  const options = (): RunOptions => ({
    apiKey,
    queryTemplate,
    areas: areasText.split('\n').map((a) => a.trim()).filter(Boolean),
    langMode,
    maxPerArea,
    photosMeta,
    photoUris,
    geoEnrich,
    reEnrich,
  })

  const stats = useMemo(() => {
    const details = places.filter((p) => p._details_done).length
    const geo = places.filter((p) => p._geo_enriched_at).length
    const avg = places.length
      ? Math.round(places.reduce((s, p) => s + (p._completeness ?? 0), 0) / places.length)
      : 0
    return { details, geo, avg }
  }, [places])

  const costUsd = calcCost(sku)

  const confirmReset = () => {
    if (window.confirm('Delete all stored places from this browser? This cannot be undone.')) {
      void collector.reset()
    }
  }

  return (
    <StepCard step={3} title="Configure & run">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="query-template" className="text-sm font-medium text-slate-300">
            Query template
          </label>
          <input
            id="query-template"
            value={queryTemplate}
            onChange={(e) => setQueryTemplate(e.target.value)}
            className={inputClass}
            disabled={running}
          />
          <p className="text-xs text-slate-500">
            {'{area}'} is replaced with each line from the areas list.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="areas" className="text-sm font-medium text-slate-300">
            Areas (one per line)
          </label>
          <textarea
            id="areas"
            rows={6}
            value={areasText}
            onChange={(e) => setAreasText(e.target.value)}
            className={`${inputClass} resize-y font-mono text-xs`}
            disabled={running}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="lang-mode" className="text-xs font-medium text-slate-400">
            Language
          </label>
          <select
            id="lang-mode"
            value={langMode}
            onChange={(e) => setLangMode(e.target.value as 'both' | 'en')}
            className={`${inputClass} w-auto`}
            disabled={running}
          >
            <option value="both">both (EN+AR, 2 calls/place)</option>
            <option value="en">en (1 call/place)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="max-per-area" className="text-xs font-medium text-slate-400">
            Max / area
          </label>
          <select
            id="max-per-area"
            value={maxPerArea}
            onChange={(e) => setMaxPerArea(Number(e.target.value))}
            className={`${inputClass} w-auto`}
            disabled={running}
          >
            {[60, 40, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2" disabled={running}>
          <legend className="sr-only">Collection options</legend>
          <Check label="Photos metadata" checked={photosMeta} onChange={setPhotosMeta} />
          <Check label="Photo URIs (extra billed)" checked={photoUris} onChange={setPhotoUris} />
          <Check label="Geocode enrichment" checked={geoEnrich} onChange={setGeoEnrich} />
          <Check label="Re-enrich stale masks" checked={reEnrich} onChange={setReEnrich} />
        </fieldset>
      </div>

      <Callout>
        Geocoding throttles to 5 req/sec and caps at{' '}
        <code className="font-mono text-amber-100">NEXT_PUBLIC_GEOCODING_MAX_PER_RUN</code> (currently{' '}
        {config.geocodingMaxPerRun.toLocaleString()}) per run.
      </Callout>

      <div className="flex flex-wrap gap-2">
        <ActionButton tone="success" onClick={() => collector.start(options())} disabled={running}>
          Start Collection
        </ActionButton>
        <ActionButton tone="warn" onClick={collector.togglePause} disabled={!running}>
          {paused ? 'Resume' : 'Pause'}
        </ActionButton>
        <ActionButton tone="warn" onClick={() => collector.retry(options())} disabled={running}>
          Retry Failed
        </ActionButton>
        <ActionButton onClick={confirmReset} disabled={running}>
          Reset Database
        </ActionButton>
      </div>

      <div className="flex flex-col gap-2">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label="Collection progress"
          aria-valuenow={Math.round(progress.pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-sky-400 transition-[width] duration-300"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <p className="text-sm text-slate-400" aria-live="polite">
          {progress.text} · {Math.round(progress.pct)}%{paused && ' · paused'}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Found" value={found.toLocaleString()} tone="accent" />
        <StatCard label="Details" value={stats.details.toLocaleString()} />
        <StatCard label="Geo-enriched" value={stats.geo.toLocaleString()} />
        <StatCard label="Stored" value={places.length.toLocaleString()} tone="ok" />
        <StatCard label="Errors" value={errors.toLocaleString()} tone={errors ? 'err' : 'default'} />
        <StatCard label="Est. cost (USD)" value={`$${costUsd.toFixed(2)}`} tone="warn" />
        <StatCard label="Complete %" value={`${stats.avg}%`} />
      </dl>

      <p className="font-mono text-xs text-slate-400">
        {(Object.keys(PRICES) as Sku[])
          .map((s) => `${SKU_LABELS[s]}: ${sku[s]} ($${skuCost(s, sku[s]).toFixed(2)})`)
          .join(' · ')}
        {' · '}
        <span className="text-amber-400">≈ {usdToQar(costUsd).toFixed(2)} QAR</span>
      </p>

      <LogPanel logs={logs} />
    </StepCard>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-sky-400"
      />
      {label}
    </label>
  )
}
