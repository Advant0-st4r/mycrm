'use client'

import type { LogEntry } from '@/lib/types'

const STATUS_TEXT = {
  ok: 'Update complete',
  warn: 'Needs attention',
  err: 'Something could not be completed',
  info: 'Working on your request',
} as const

const STATUS_CLASS = {
  ok: 'text-green-300',
  warn: 'text-amber-300',
  err: 'text-red-300',
  info: 'text-slate-300',
} as const

export function LogPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <section aria-label="Activity updates" className="max-h-56 min-h-24 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950 p-3 text-sm leading-relaxed">
      <h3 className="mb-2 font-medium text-slate-200">Activity updates</h3>
      {logs.length === 0 ? (
        <p className="text-slate-400">Updates will appear here while your request runs.</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-live="polite">
          {logs.slice(-30).map((entry) => (
            <li key={entry.id} className={STATUS_CLASS[entry.level]}>{STATUS_TEXT[entry.level]}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
