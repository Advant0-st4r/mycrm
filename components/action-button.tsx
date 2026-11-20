import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONES = {
  primary: 'bg-sky-400 text-slate-950 hover:bg-sky-300',
  success: 'bg-green-500 text-slate-950 hover:bg-green-400',
  warn: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
  danger: 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25',
  secondary: 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700',
} as const

type Props = ComponentProps<typeof Button> & { tone?: keyof typeof TONES }

export function ActionButton({ tone = 'secondary', className, ...props }: Props) {
  return <Button size="lg" className={cn('px-3', TONES[tone], className)} {...props} />
}

export const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30'
