interface StatCardProps {
  label: string
  value: string | number
  tone?: 'default' | 'ok' | 'warn' | 'err' | 'accent'
}

const TONE_CLASS = {
  default: 'text-slate-50',
  ok: 'text-green-400',
  warn: 'text-amber-400',
  err: 'text-red-400',
  accent: 'text-sky-400',
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800 px-3 py-3">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}>{value}</dd>
    </div>
  )
}
