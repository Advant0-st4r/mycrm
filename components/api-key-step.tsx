'use client'

import { useState } from 'react'
import { ActionButton, inputClass } from './action-button'
import { StepCard } from './step-card'
import { reverseGeocode, textSearch } from '@/lib/api'

interface ApiKeyStepProps {
  apiKey: string
  onSave: (key: string) => void
  onClear: () => void
  disabled?: boolean
}

type TestResult = { ok: boolean; text: string } | null

export function ApiKeyStep({ apiKey, onSave, onClear, disabled = false }: ApiKeyStepProps) {
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
          setStatus('Checking your Google Maps connection…')
    setPlaces(null)
    setGeo(null)

    try {
      const res = await textSearch(key, 'restaurants in Doha, Qatar', 'places.id,places.displayName')
      setPlaces({ ok: true, text: `Place search is ready (${res.places.length} results)` })
    } catch {
      setPlaces({ ok: false, text: 'Place search could not connect. Check your key and settings.' })
    }

    try {
      const res = await reverseGeocode(key, 25.2854, 51.531)
      setGeo({ ok: true, text: res?.formatted ? 'Nearby address lookup is ready.' : 'Address lookup is ready.' })
    } catch {
      setGeo({ ok: false, text: 'Address lookup could not connect. Check your key and settings.' })
    }

    setTesting(false)
    setStatus('Test complete.')
  }

  return (
    <StepCard step={2} title="Connect your access key">
      <div className="flex flex-col gap-2">
        <label htmlFor="api-key" className="text-sm font-medium text-slate-300">
          Google Maps access key
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
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton tone="primary" onClick={save} disabled={disabled}>
          Save Key
        </ActionButton>
        <ActionButton tone="success" onClick={test} disabled={testing || disabled}>
          {testing ? 'Checking…' : 'Check connection'}
        </ActionButton>
        <ActionButton tone="danger" onClick={clear} disabled={disabled}>
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
