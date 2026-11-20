'use client'

import { useState } from 'react'
import { ActionButton, inputClass } from './action-button'
import { StepCard } from './step-card'
import { reverseGeocode, textSearch } from '@/lib/api'

interface ApiKeyStepProps {
  apiKey: string
  onSave: (key: string) => void
  onClear: () => void
}

type TestResult = { ok: boolean; text: string } | null

export function ApiKeyStep({ apiKey, onSave, onClear }: ApiKeyStepProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)
  const [places, setPlaces] = useState<TestResult>(null)
  const [geo, setGeo] = useState<TestResult>(null)

  const value = draft ?? apiKey

  const save = () => {
    const key = value.trim()
    if (!key) {
      setStatus('Enter a key first.')
      return
    }
    onSave(key)
    setDraft(null)
    setStatus('Key saved to this browser.')
  }

  const clear = () => {
    onClear()
    setDraft('')
    setPlaces(null)
    setGeo(null)
    setStatus('Key cleared.')
  }

  const test = async () => {
    const key = value.trim()
    if (!key) {
      setStatus('Enter a key first.')
      return
    }
    setTesting(true)
    setStatus('Testing Places API (New) and Geocoding API…')
    setPlaces(null)
    setGeo(null)

    try {
      const res = await textSearch(key, 'restaurants in Doha, Qatar', 'places.id,places.displayName')
      setPlaces({ ok: true, text: `Places (${res.places.length} results)` })
    } catch (e) {
      setPlaces({ ok: false, text: `Places (${e instanceof Error ? e.message : 'error'})` })
    }

    try {
      const res = await reverseGeocode(key, 25.2854, 51.531)
      setGeo({ ok: true, text: `Geocoding (${res?.formatted ?? 'no street-level result'})` })
    } catch (e) {
      setGeo({ ok: false, text: `Geocoding (${e instanceof Error ? e.message : 'error'})` })
    }

    setTesting(false)
    setStatus('Test complete.')
  }

  return (
    <StepCard step={2} title="Enter your API Key">
      <div className="flex flex-col gap-2">
        <label htmlFor="api-key" className="text-sm font-medium text-slate-300">
          Google Maps API key
        </label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="AIzaSy…"
          className={`${inputClass} font-mono`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton tone="primary" onClick={save}>
          Save Key
        </ActionButton>
        <ActionButton tone="success" onClick={test} disabled={testing}>
          {testing ? 'Testing…' : 'Test Both APIs'}
        </ActionButton>
        <ActionButton tone="danger" onClick={clear}>
          Clear
        </ActionButton>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {status && <p className="text-sm text-slate-400">{status}</p>}
        {(places || geo) && (
          <div className="flex flex-wrap gap-2">
            {[places, geo].map(
              (r, i) =>
                r && (
                  <span
                    key={i}
                    className={`max-w-full break-words rounded-full border px-3 py-1 text-xs font-medium ${
                      r.ok
                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                        : 'border-red-500/40 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {r.ok ? '✓' : '✗'} {r.text}
                  </span>
                ),
            )}
          </div>
        )}
      </div>
    </StepCard>
  )
}
