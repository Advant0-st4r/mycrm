'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiKeyStep } from '@/components/api-key-step'
import { ApiSetupStep } from '@/components/api-setup-step'
import { CollectionStep } from '@/components/collection-step'
import { DataTable } from '@/components/data-table'
import { DeliveryPlatforms } from '@/components/delivery-platforms'
import { FailedQueue } from '@/components/failed-queue'
import { useCollector } from '@/hooks/use-collector'
import { usePlaces } from '@/hooks/use-places'
import { API_KEY_STORAGE, config } from '@/lib/config'
import { clearAllFailures, upsertPlace } from '@/lib/db'
import type { DeliveryCountry, Place } from '@/lib/types'

export default function Page() {
  const [apiKey, setApiKey] = useState('')
  const [deliveryCountry, setDeliveryCountry] = useState<DeliveryCountry>('QA')
  const { places, refresh } = usePlaces()
  const collector = useCollector(refresh)

  useEffect(() => {
    setApiKey(localStorage.getItem(API_KEY_STORAGE) || config.apiKey)
    collector.loadAttempts()
  }, [collector.loadAttempts])

  const saveKey = useCallback((key: string) => {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
  }, [])

  const clearKey = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey('')
  }, [])

  const importTalabatPlaces = useCallback(async (incoming: Place[]) => {
    for (const place of incoming) await upsertPlace(place)
    refresh()
  }, [refresh])

  const clearQueue = useCallback(async () => {
    await clearAllFailures()
    collector.log('Retry queue cleared', 'warn')
    refresh()
  }, [collector, refresh])

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">
            Restaurant Finder
          </h1>
          <p className="text-pretty text-sm text-slate-400 md:text-base">
            Find restaurants, add helpful details, and keep an eye on estimated costs.
          </p>
        </header>

        <nav aria-label="Setup progress" className="flex flex-wrap gap-2" data-testid="step-indicator">
          {['Prepare', 'Connect', 'Collect', 'Review'].map((label, index) => (
            <div key={label} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              <span className="flex size-5 items-center justify-center rounded-full bg-sky-500/20 font-semibold text-sky-300">{index + 1}</span>
              {label}
            </div>
          ))}
        </nav>
        <ApiSetupStep />
        <ApiKeyStep apiKey={apiKey} onSave={saveKey} onClear={clearKey} disabled={collector.running && !collector.paused} />
        <DeliveryPlatforms
          country={deliveryCountry}
          onCountryChange={setDeliveryCountry}
          onImportTalabat={importTalabatPlaces}
        />
        <CollectionStep apiKey={apiKey} places={places} collector={collector} />
        <FailedQueue
          places={places}
          onRefresh={refresh}
          onClear={clearQueue}
          disabled={collector.running}
        />
        <DataTable places={places} onRefresh={refresh} deliveryCountry={deliveryCountry} />

        <footer className="border-t border-slate-800 pt-6 text-xs leading-relaxed text-slate-500">
          Data is retrieved from Google Maps Platform and stored only in this browser (IndexedDB).
          Use, caching, and redistribution are subject to the{' '}
          <a
            href="https://cloud.google.com/maps-platform/terms"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-slate-300"
          >
            Google Maps Platform Terms of Service
          </a>
          , including attribution requirements and limits on long-term storage of Places content.
        </footer>
      </main>
    </div>
  )
}
