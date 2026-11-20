'use client'

import { useMemo } from 'react'
import { ActionButton } from './action-button'
import { StepCard } from './step-card'
import type { Place } from '@/lib/types'

interface FailedQueueProps {
  places: Place[]
  onRefresh: () => void
  onClear: () => void
  disabled?: boolean
}

export function FailedQueue({ places, onRefresh, onClear, disabled }: FailedQueueProps) {
  const rows = useMemo(
    () =>
      places.flatMap((p) =>
        (p._failed ?? []).map((f) => ({ key: `${p.id}:${f.lang}`, place: p, entry: f })),
      ),
    [places],
  )
  const placeCount = useMemo(() => places.filter((p) => p._failed?.length).length, [places])

  return (
    <StepCard title="Failed queue">
      <p className="text-sm text-slate-300">
        {placeCount} places in retry queue.
        {rows.length > placeCount && ` (${rows.length} failed calls)`}
      </p>

      <div className="max-h-48 overflow-auto rounded-lg border border-slate-700/60">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-800 text-slate-300">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Place ID</th>
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Lang</th>
              <th scope="col" className="px-3 py-2 font-medium">Error</th>
              <th scope="col" className="px-3 py-2 font-medium">Tries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  No failures. Nice.
                </td>
              </tr>
            ) : (
              rows.map(({ key, place, entry }) => (
                <tr key={key} className="text-slate-200">
                  <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-slate-400" title={place.id}>
                    {place.id}
                  </td>
                  <td className="px-3 py-2">{place.name_en ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{entry.lang}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-red-300" title={entry.error}>
                    {entry.error}
                  </td>
                  <td className={`px-3 py-2 font-mono ${entry.tries >= 4 ? 'text-red-400' : 'text-amber-400'}`}>
                    {entry.tries}/4
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={onRefresh}>Refresh</ActionButton>
        <ActionButton tone="danger" onClick={onClear} disabled={disabled || rows.length === 0}>
          Clear Queue
        </ActionButton>
      </div>
    </StepCard>
  )
}
