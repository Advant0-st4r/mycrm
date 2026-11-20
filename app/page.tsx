'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiKeyStep } from '@/components/api-key-step'
import { ApiSetupStep } from '@/components/api-setup-step'
import { CollectionStep } from '@/components/collection-step'
import { DataTable } from '@/components/data-table'
import { FailedQueue } from '@/components/failed-queue'
import { useCollector } from '@/hooks/use-collector'
import { usePlaces } from '@/hooks/use-places'
import { API_KEY_STORAGE, config } from '@/lib/config'
import { clearAllFailures } from '@/lib/db'

export default function Page() {
  const [apiKey, setApiKey] = useState('')
  const { places, refresh } = usePlaces()
  const collector = useCollector(refresh)

  useEffect(() => {
    setApiKey(localStorage.getItem(API_KEY_STORAGE) || config.apiKey)
  }, [])

  const saveKey = useCallback((key: string) => {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
  }, [])

  const clearKey = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey('')
  }, [])

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
            {config.appName}
          </h1>
          <p className="text-pretty text-sm text-slate-400 md:text-base">
            Maximal accurate Google Places extraction · geocoding-enriched · cost-aware
          </p>
        </header>

        <ApiSetupStep />
        <ApiKeyStep apiKey={apiKey} onSave={saveKey} onClear={clearKey} />
        <CollectionStep apiKey={apiKey} places={places} collector={collector} />
        <FailedQueue
          places={places}
          onRefresh={refresh}
          onClear={clearQueue}
          disabled={collector.running}
        />
        <DataTable places={places} onRefresh={refresh} />

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
