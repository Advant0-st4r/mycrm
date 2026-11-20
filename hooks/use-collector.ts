'use client'

import { useCallback, useRef, useState } from 'react'
import { runCollection, runRetry, sleep, type RunCallbacks, type RunOptions } from '@/lib/collector'
import { clearPlaces } from '@/lib/db'
import { emptySkuCounts, type Sku, type SkuCounts } from '@/lib/pricing'
import type { LogEntry, LogLevel } from '@/lib/types'

const MAX_LOGS = 500

export function useCollector(onDataChanged: () => void) {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, text: 'Idle' })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [sku, setSku] = useState<SkuCounts>(emptySkuCounts)
  const [found, setFound] = useState(0)
  const [errors, setErrors] = useState(0)

  const pausedRef = useRef(false)
  const logId = useRef(0)

  const log = useCallback((msg: string, level: LogLevel = 'info') => {
    const entry: LogEntry = {
      id: ++logId.current,
      ts: new Date().toLocaleTimeString(),
      level,
      msg,
    }
    setLogs((prev) => {
      const next = [...prev, entry]
      return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
    })
  }, [])

  const callbacks = useCallback(
    (): RunCallbacks => ({
      log,
      progress: (pct, text) => setProgress({ pct: Math.min(100, Math.max(0, pct)), text }),
      sku: (s: Sku) => setSku((prev) => ({ ...prev, [s]: prev[s] + 1 })),
      error: () => setErrors((n) => n + 1),
      found: setFound,
      checkpoint: async () => {
        while (pausedRef.current) await sleep(250)
      },
      dataChanged: onDataChanged,
    }),
    [log, onDataChanged],
  )

  const execute = useCallback(
    async (task: (cb: RunCallbacks) => Promise<void>) => {
      if (running) return
      setRunning(true)
      pausedRef.current = false
      setPaused(false)
      try {
        await task(callbacks())
      } catch (e) {
        log(`Run aborted: ${e instanceof Error ? e.message : String(e)}`, 'err')
      } finally {
        setRunning(false)
        pausedRef.current = false
        setPaused(false)
        onDataChanged()
      }
    },
    [running, callbacks, log, onDataChanged],
  )

  const start = useCallback(
    (opts: RunOptions) => {
      if (!opts.apiKey) {
        log('No API key set — save one in Step 2 first', 'err')
        return
      }
      if (!opts.areas.length) {
        log('Add at least one area', 'err')
        return
      }
      setFound(0)
      setErrors(0)
      log(`Starting collection across ${opts.areas.length} areas`, 'info')
      void execute((cb) => runCollection(opts, cb))
    },
    [execute, log],
  )

  const retry = useCallback(
    (opts: RunOptions) => {
      if (!opts.apiKey) {
        log('No API key set — save one in Step 2 first', 'err')
        return
      }
      void execute((cb) => runRetry(opts, cb))
    },
    [execute, log],
  )

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    log(pausedRef.current ? 'Paused' : 'Resumed', 'warn')
  }, [log])

  const reset = useCallback(async () => {
    await clearPlaces()
    setSku(emptySkuCounts())
    setFound(0)
    setErrors(0)
    setProgress({ pct: 0, text: 'Idle' })
    log('Database reset', 'warn')
    onDataChanged()
  }, [log, onDataChanged])

  return { running, paused, progress, logs, sku, found, errors, start, retry, togglePause, reset, log }
}
