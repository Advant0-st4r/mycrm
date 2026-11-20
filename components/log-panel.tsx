'use client'

import { useEffect, useRef } from 'react'
import type { LogEntry } from '@/lib/types'

const LEVEL_CLASS = {
  ok: 'text-green-400',
  warn: 'text-amber-400',
  err: 'text-red-400',
  info: 'text-slate-300',
}

export function LogPanel({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label="Collection log"
      className="max-h-56 min-h-24 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950 p-3 font-mono text-xs leading-relaxed"
    >
      {logs.length === 0 ? (
        <p className="text-slate-500">Log output will appear here.</p>
      ) : (
        logs.map((l) => (
          <div key={l.id} className={LEVEL_CLASS[l.level]}>
            <span className="text-slate-500">[{l.ts}]</span> {l.msg}
          </div>
        ))
      )}
    </div>
  )
}
