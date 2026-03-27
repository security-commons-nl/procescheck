import { clsx } from 'clsx'

type Variant = 'green' | 'red' | 'blue' | 'yellow' | 'gray' | 'orange' | 'purple'

const VARIANTS: Record<Variant, string> = {
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
  blue:   'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray:   'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-800',
  purple: 'bg-purple-100 text-purple-800',
}

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', VARIANTS[variant])}>
      {children}
    </span>
  )
}

export function CriticalBadge({ isCritical }: { isCritical: boolean }) {
  return <Badge variant={isCritical ? 'red' : 'gray'}>{isCritical ? 'Kritisch' : 'Niet kritisch'}</Badge>
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Catastrofaal', 2: 'Kritiek / zeer ernstig', 3: 'Gemiddeld', 4: 'Gering', 5: 'Verwaarloosbaar',
}
const SCORE_VARIANTS: Record<number, Variant> = {
  1: 'red', 2: 'orange', 3: 'yellow', 4: 'blue', 5: 'green',
}

export function ScoreBadge({ score }: { score?: number | null }) {
  if (!score) return <span className="text-gray-400 text-xs">—</span>
  return <Badge variant={SCORE_VARIANTS[score] ?? 'gray'}>{SCORE_LABELS[score]}</Badge>
}

export function CompleteBadge({ complete }: { complete: boolean }) {
  return <Badge variant={complete ? 'green' : 'gray'}>{complete ? '✓ Ingevuld' : '○ Ontbreekt'}</Badge>
}
