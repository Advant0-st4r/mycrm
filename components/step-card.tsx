import type { ReactNode } from 'react'

interface StepCardProps {
  step?: number
  icon?: string
  title: string
  children: ReactNode
}

export function StepCard({ step, icon, title, children }: StepCardProps) {
  const headingId = `step-${step ?? title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-slate-700/60 bg-slate-900 p-5 md:p-6"
    >
      <h2 id={headingId} className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-50">
        {step !== undefined ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-sky-400 text-sm font-bold text-slate-950">
            {step}
          </span>
        ) : (
          icon && <span aria-hidden="true">{icon}</span>
        )}
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function Callout({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'sky' }) {
  const styles =
    tone === 'amber'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
      : 'border-sky-400/40 bg-sky-400/10 text-sky-200'
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>
}
