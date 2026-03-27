import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../../api/dashboard'
import { Card } from '../../components/common/Card'
import PageHeader from '../../components/common/PageHeader'
import { ScoreBadge } from '../../components/common/Badge'
import { GitBranch, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { ProcessCompleteness, BivTopItem } from '../../types'
import { clsx } from 'clsx'

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  colorClass: string
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={clsx('p-3 rounded-lg', colorClass)}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </Card>
  )
}

// ── Incomplete process row ────────────────────────────────────────────────────

function IncompleteRow({ process }: { process: ProcessCompleteness }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
          <span className="font-mono text-xs text-gray-400 shrink-0">{process.code}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{process.name}</span>
        </div>
        <span className={clsx(
          'text-xs font-medium shrink-0 ml-3',
          process.missing_fields.length >= 4 ? 'text-red-600' : 'text-orange-500'
        )}>
          {process.missing_fields.length} ontbrekend
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 ml-7">
          <ul className="space-y-1 mb-3">
            {process.missing_fields.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate(`/processes/${process.id}`)}
            className="text-xs text-brand-600 hover:underline font-medium"
          >
            Ga naar proces →
          </button>
        </div>
      )}
    </div>
  )
}

// ── BIV top list ─────────────────────────────────────────────────────────────

const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-yellow-400',
  4: 'bg-blue-400',
  5: 'bg-green-400',
}

function BivTopList({
  title,
  items,
}: {
  title: string
  items: BivTopItem[]
}) {
  const navigate = useNavigate()

  return (
    <Card>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-300 py-2">Geen BIA-gegevens beschikbaar.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li
              key={item.process_id}
              className="flex items-center justify-between gap-2 cursor-pointer group"
              onClick={() => navigate(`/processes/${item.process_id}`)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={clsx('w-2 h-2 rounded-full shrink-0', SCORE_COLORS[item.score] ?? 'bg-gray-300')} />
                <span className="text-sm text-gray-700 truncate group-hover:text-brand-600 transition-colors">
                  {item.process_name}
                </span>
              </div>
              <ScoreBadge score={item.score} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── Collapsible action section ────────────────────────────────────────────────

function CollapsibleActionSection({ incomplete }: { incomplete: ProcessCompleteness[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-6">
      <button
        className="flex items-center gap-2 mb-2 group"
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown
          size={14}
          className={clsx(
            'text-gray-400 transition-transform duration-200',
            !open && '-rotate-90'
          )}
        />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Actie vereist
        </span>
        {incomplete.length > 0 && (
          <span className="bg-orange-100 text-orange-600 rounded-full px-2 py-0.5 text-xs font-medium normal-case">
            {incomplete.length}
          </span>
        )}
      </button>

      {open && (
        <Card className="p-0 overflow-hidden">
          {incomplete.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-green-700">
              <CheckCircle2 size={16} className="text-green-500" />
              Alle processen zijn op orde.
            </div>
          ) : (
            incomplete.map(p => <IncompleteRow key={p.id} process={p} />)
          )}
        </Card>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.summary,
  })
  const { data: completeness = [] } = useQuery({
    queryKey: ['dashboard', 'completeness'],
    queryFn: dashboardApi.completeness,
  })
  const { data: bivTop } = useQuery({
    queryKey: ['dashboard', 'biv-top'],
    queryFn: () => dashboardApi.bivTop(5),
  })

  const incomplete = completeness.filter(p => !p.is_complete)
  const hasData = completeness.length > 0

  return (
    <div className="max-w-5xl">
      <PageHeader title="Dashboard" subtitle={`${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`} />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={GitBranch}
          label="Totaal processen"
          value={summary?.total_processes ?? 0}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Op orde"
          value={summary?.complete_count ?? 0}
          colorClass="bg-green-50 text-green-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Aandacht vereist"
          value={summary?.attention_count ?? 0}
          colorClass="bg-orange-50 text-orange-500"
        />
        <StatCard
          icon={XCircle}
          label="Niet op orde"
          value={summary?.incomplete_count ?? 0}
          colorClass="bg-red-50 text-red-500"
        />
      </div>

      {/* ── Incomplete processes ── */}
      {hasData && (
        <CollapsibleActionSection incomplete={incomplete} />
      )}

      {/* ── BIV top lists ── */}
      {hasData && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Hoogste eisen per BIV-dimensie
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <BivTopList
              title="Beschikbaarheid"
              items={bivTop?.availability ?? []}
            />
            <BivTopList
              title="Integriteit"
              items={bivTop?.integrity ?? []}
            />
            <BivTopList
              title="Vertrouwelijkheid"
              items={bivTop?.confidentiality ?? []}
            />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasData && (
        <Card className="text-center py-12 text-gray-400">
          <GitBranch size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nog geen processen. Ga naar <strong>Processen</strong> om te beginnen.</p>
        </Card>
      )}
    </div>
  )
}
