'use client'

import type { LogEntry } from '@/lib/types'

const STATUS_LABEL = {
  ok: 'Done',
  warn: 'Heads up',
  err: 'Problem',
  info: 'Progress',
} as const

const STATUS_CLASS = {
  ok: 'text-green-300',
  warn: 'text-amber-200',
  err: 'text-red-200',
  info: 'text-slate-300',
} as const

function explainUpdate(entry: LogEntry): string | null {
  const message = entry.msg

  if (message === 'Retry queue cleared') return 'Cleared the list of items waiting to be tried again.'

  const searchFailure = message.match(/^Search failed for "(.+?)":/)
  if (searchFailure) return `Couldn’t search ${searchFailure[1]}. Check the area name or try a broader search.`

  const detailsFailure = message.match(/^Details (?:en|ar) failed for (.+?):/)
  if (detailsFailure) return `Couldn’t load all details for ${detailsFailure[1]}. The restaurant is still saved; you can try again later.`

  const addressFailure = message.match(/^Geocode failed for (.+?):/)
  if (addressFailure) return `Couldn’t find a nearby address for ${addressFailure[1]}. Other restaurant details are still saved.`

  const photoFailure = message.match(/^Photo URI failed for (.+?):/)
  if (photoFailure) return `Couldn’t load a photo link for ${photoFailure[1]}. The rest of its details are still saved.`

  const retryFailure = message.match(/^Retry failed: (.+?) \([^)]*\):/)
  if (retryFailure) return `Couldn’t update ${retryFailure[1]} after another try. It remains in the issues list.`

  if (/Rate limited on/.test(message)) return 'The maps service is busy. Pausing briefly, then it will try again automatically.'
  if (/Geocoding capped at (\d+); (\d+) deferred/.test(message)) {
    const [, limit, deferred] = message.match(/Geocoding capped at (\d+); (\d+) deferred/)!
    return `Address lookups are limited to ${limit} per run. ${deferred} more can be updated on a later run.`
  }
  const skipped = message.match(/^(\d+) entries reached \d+ tries and were skipped$/)
  if (skipped) return `${skipped[1]} items still need attention after several tries. You can try them again later.`
  if (message === 'Phase 3 skipped (geocode enrichment off)') return 'Address lookups were skipped. Turn on “Add nearby address details” if you need them.'
  const backoff = message.match(/^Backoff \d+s before retrying (.+)$/)
  if (backoff) return `Waiting briefly before trying ${backoff[1]} again.`

  const detailsStarted = message.match(/^Phase 2: fetching details for (\d+) places/)
  if (detailsStarted) return `Adding details for ${detailsStarted[1]} restaurants.`
  const addressesStarted = message.match(/^Phase 3: reverse geocoding (\d+) places$/)
  if (addressesStarted) return `Looking up addresses for ${addressesStarted[1]} restaurants.`
  const retryStarted = message.match(/^Retrying (\d+) failed calls$/)
  if (retryStarted) return `Trying again on ${retryStarted[1]} items that need attention.`
  if (message === 'Retry queue is empty') return 'There are no items waiting to be tried again.'

  const found = message.match(/^Phase 1 complete: (\d+) unique places found$/)
  if (found) return `Search finished. Found ${found[1]} restaurants.`
  if (message === 'Phase 2 complete') return 'Restaurant details finished updating.'
  if (message === 'Phase 3 complete') return 'Address lookups finished.'
  if (message === 'Collection complete') return 'Your restaurant search is finished.'
  if (message === 'Retry pass complete') return 'Finished trying the items that needed attention.'

  const retrySuccess = message.match(/^Retry ok: (.+?) \([^)]*\)$/)
  if (retrySuccess) return `Updated details for ${retrySuccess[1]}.`

  if (/^".+" page \d+: \d+ results \(\d+ for area\)$/.test(message)) return null
  return 'Update finished.'
}

export function LogPanel({ logs }: { logs: LogEntry[] }) {
  const visibleLogs = logs.slice(-30).flatMap((entry) => {
    const message = explainUpdate(entry)
    return message ? [{ entry, message }] : []
  })
  const latestIssue = [...logs].reverse().find((entry) => entry.level === 'err' || entry.level === 'warn')

  return (
    <section aria-label="Activity updates" className="rounded-lg border border-slate-700/60 bg-slate-950 p-3 text-sm leading-relaxed">
      <h3 className="mb-2 font-medium text-slate-200">Activity updates</h3>
      {latestIssue && (
        <div
          role={latestIssue.level === 'err' ? 'alert' : 'status'}
          aria-live={latestIssue.level === 'err' ? 'assertive' : 'polite'}
          className={`mb-3 rounded-md border px-3 py-2 ${latestIssue.level === 'err' ? 'border-red-400/50 bg-red-400/10 text-red-100' : 'border-amber-400/50 bg-amber-400/10 text-amber-100'}`}
        >
          <p className="font-semibold">{latestIssue.level === 'err' ? 'Needs attention' : 'Heads up'}</p>
          <p>{explainUpdate(latestIssue)}</p>
        </div>
      )}
      {visibleLogs.length === 0 ? (
        <p className="text-slate-400">Updates will appear here while your request runs.</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto" aria-live="polite" aria-relevant="additions text">
          {visibleLogs.map(({ entry, message }) => (
            <li
              key={entry.id}
              className={`flex items-start gap-2 rounded-md px-2 py-1 ${entry.level === 'err' ? 'border border-red-400/30 bg-red-400/5' : entry.level === 'warn' ? 'border border-amber-400/30 bg-amber-400/5' : ''}`}
            >
              <span className={`shrink-0 font-medium ${STATUS_CLASS[entry.level]}`}>{STATUS_LABEL[entry.level]}</span>
              <span className="text-slate-300">{message}</span>
              <time className="ml-auto shrink-0 text-xs text-slate-500">{entry.ts}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
