'use client'

import { useCallback, useRef, useState } from 'react'
import { runCollection, runRetry, sleep, type RunCallbacks, type RunOptions } from '@/lib/collector'
import { clearPlaces } from '@/lib/db'
import { emptySkuCounts, type Sku, type SkuCounts } from '@/lib/pricing'
import type { LogEntry, LogLevel } from '@/lib/types'

const MAX_LOGS = 500
const ATTEMPTS_KEY = 'delivery-platform-saved-attempts'
export type AttemptStatus = 'Waiting for confirmation' | 'Running' | 'Paused' | 'Updated' | 'Canceled' | 'Ready to download'
export interface SavedAttempt {
  attempt: number
  status: AttemptStatus
  savedAt: string
  found: number
  errors: number
  areas: number
}

export function useCollector(onDataChanged: () => void) {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, text: 'Idle' })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [sku, setSku] = useState<SkuCounts>(emptySkuCounts)
  const [found, setFound] = useState(0)
  const [errors, setErrors] = useState(0)
  const [attempts, setAttempts] = useState<SavedAttempt[]>([])
  const pausedRef = useRef(false)
  const canceledRef = useRef(false)
  const logId = useRef(0)
  const activeOptionsRef = useRef<RunOptions | null>(null)
  const foundRef = useRef(found)
  const errorsRef = useRef(errors)
  foundRef.current = found
  errorsRef.current = errors

  const appendAttempt = useCallback((status: AttemptStatus, areaCount = activeOptionsRef.current?.areas.length ?? 0) => {
    setAttempts((previous) => {
      const nextAttempt = [...previous, {
        attempt: previous.length + 1,
        status,
        savedAt: new Date().toISOString(),
        found: foundRef.current,
        errors: errorsRef.current,
        areas: areaCount,
      }]
      try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(nextAttempt)) } catch { /* Storage may be unavailable. */ }
      return nextAttempt
    })
  }, [found, errors])

  const loadAttempts = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]')
      if (Array.isArray(saved)) setAttempts(saved)
    } catch { setAttempts([]) }
  }, [])

  const log = useCallback((msg: string, level: LogLevel = 'info') => {
    const entry: LogEntry = { id: ++logId.current, ts: new Date().toLocaleTimeString(), level, msg }
    setLogs((prev) => {
      const next = [...prev, entry]
      return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
    })
  }, [])

  const callbacks = useCallback((): RunCallbacks => ({
    log,
    progress: (pct, text) => setProgress({ pct: Math.min(100, Math.max(0, pct)), text }),
    sku: (s: Sku) => setSku((prev) => ({ ...prev, [s]: prev[s] + 1 })),
    error: () => setErrors((n) => n + 1),
    found: setFound,
    checkpoint: async () => {
      while (pausedRef.current && !canceledRef.current) await sleep(250)
      if (canceledRef.current) throw new Error('Run canceled')
    },
    dataChanged: onDataChanged,
  }), [log, onDataChanged])

  const execute = useCallback(async (task: (cb: RunCallbacks) => Promise<void>) => {
    if (running) return
    setRunning(true)
    pausedRef.current = false
    canceledRef.current = false
    setPaused(false)
    appendAttempt('Running')
    try {
      await task(callbacks())
      if (!canceledRef.current) appendAttempt('Ready to download')
    } catch (e) {
      if (!canceledRef.current) log(`Run stopped: ${e instanceof Error ? e.message : String(e)}`, 'err')
    } finally {
      setRunning(false)
      pausedRef.current = false
      setPaused(false)
      activeOptionsRef.current = null
      onDataChanged()
    }
  }, [running, callbacks, log, onDataChanged, appendAttempt])

  const requestStart = useCallback((opts: RunOptions, mode: 'collect' | 'retry' = 'collect') => {
    if (!opts.apiKey || (mode === 'collect' && !opts.areas.length)) return
    activeOptionsRef.current = opts
    appendAttempt('Waiting for confirmation', opts.areas.length)
    return mode
  }, [appendAttempt])

  const confirmStart = useCallback((opts: RunOptions, mode: 'collect' | 'retry' = 'collect') => {
    activeOptionsRef.current = opts
    setFound(0)
    setErrors(0)
    void execute((cb) => mode === 'retry' ? runRetry(opts, cb) : runCollection(opts, cb))
  }, [execute])

  const updateAndResume = useCallback((opts: RunOptions) => {
    if (activeOptionsRef.current) Object.assign(activeOptionsRef.current, opts)
    appendAttempt('Updated', opts.areas.length)
    pausedRef.current = false
    setPaused(false)
    appendAttempt('Running', opts.areas.length)
  }, [appendAttempt])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    appendAttempt(pausedRef.current ? 'Paused' : 'Running')
  }, [appendAttempt])

  const cancel = useCallback(() => {
    canceledRef.current = true
    pausedRef.current = false
    setPaused(false)
    appendAttempt('Canceled')
  }, [appendAttempt])

  const reset = useCallback(async () => {
    await clearPlaces()
    setSku(emptySkuCounts())
    setFound(0)
    setErrors(0)
    setProgress({ pct: 0, text: 'Idle' })
    log('Stored places cleared', 'warn')
    onDataChanged()
  }, [log, onDataChanged])

  return { running, paused, progress, logs, sku, found, errors, attempts, loadAttempts, appendAttempt, requestStart, confirmStart, updateAndResume, togglePause, cancel, reset, log }
}
