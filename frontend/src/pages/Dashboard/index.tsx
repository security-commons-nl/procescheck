import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../../api/dashboard'
import { Card } from '../../components/common/Card'
import { ScoreBadge } from '../../components/common/Badge'
import {
  GitBranch, ChevronDown, ChevronRight,
  Shield, Database, Users, Eye, CheckCircle2, XCircle, FileText,
} from 'lucide-react'
import type {
  BivDimensionDistribution, CriticalProcessRisk, PriorityAction, ReviewStatus,
} from '../../types'
import { clsx } from 'clsx'

// ── Colour maps ────────────────────────────────────────────────────────────────
// Labels en kleuren identiek aan het tabblad "BIA & BIV-Classificatie"

const SCORE_BG: Record<number, string> = {
  1: 'bg-red-500',     // Catastrofaal
  2: 'bg-orange-400',  // Kritiek / zeer ernstig
  3: 'bg-yellow-400',  // Gemiddeld
  4: 'bg-blue-400',    // Gering
  5: 'bg-green-500',   // Verwaarloosbaar
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconColorClass, title, pct, count, total,
  singularLabel, pluralLabel,
}: {
  icon: React.ElementType
  iconColorClass: string
  title: string
  pct: number
  count: number
  total: number
  singularLabel: string
  pluralLabel: string
}) {
  const label = count === 1 ? singularLabel : pluralLabel
  const isComplete = pct === 100
  const pctColor = isComplete ? 'text-green-600' : 'text-red-600'
  const barColor = isComplete ? 'bg-green-500' : 'bg-red-500'

  return (
    <Card className="flex flex-col gap-3">
      {/* Titel met icoon — zelfde stijl als alle sectieheaders */}
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={iconColorClass} />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none">{title}</p>
      </div>

      {/* Percentage + teller */}
      <div className="flex items-end justify-between gap-2">
        <span className={clsx('text-2xl font-semibold tabular-nums leading-none', pctColor)}>
          {pct}%
        </span>
        <span className="text-xs text-gray-400 tabular-nums pb-0.5">
          {count}/{total}
        </span>
      </div>

      {/* Balk */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Subtitel — enkelvoud/meervoud correct */}
      <p className="text-xs text-gray-400 leading-tight truncate">{label}</p>
    </Card>
  )
}

// ── Privacy Info Card ─────────────────────────────────────────────────────────

function PrivacyInfoCard({ count, total }: { count: number; total: number }) {
  const label = count === 1 ? 'proces met persoonsgegevens' : 'processen met persoonsgegevens'
  return (
    <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Eye size={13} className="text-purple-400 shrink-0" />
        <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide leading-none">
          Privacy-exposure
        </p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold text-purple-700 tabular-nums leading-none">
          {count}
        </span>
        <span className="text-xs text-purple-300 tabular-nums pb-0.5">/ {total}</span>
      </div>
      {/* Visuele scheiding i.p.v. balk */}
      <div className="w-full h-px bg-purple-100" />
      <p className="text-xs text-purple-400 leading-tight truncate">{label}</p>
    </div>
  )
}

// ── Review KPI Panel (no Card wrapper — used inside a containing Card) ────────

function ReviewKpiPanel({
  icon: Icon, iconColorClass, title, pct, count, total, label,
}: {
  icon: React.ElementType
  iconColorClass: string
  title: string
  pct: number
  count: number
  total: number
  label: string
}) {
  const isComplete = pct === 100
  const pctColor = isComplete ? 'text-green-600' : 'text-red-600'
  const barColor = isComplete ? 'bg-green-500' : 'bg-red-500'
  return (
    <div className="flex flex-col gap-3 px-5 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={iconColorClass} />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none">{title}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={clsx('text-2xl font-semibold tabular-nums leading-none', pctColor)}>{pct}%</span>
        <span className="text-xs text-gray-400 tabular-nums pb-0.5">{count}/{total}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 leading-tight truncate">{label}</p>
    </div>
  )
}

// ── BIV Distribution Bar ───────────────────────────────────────────────────────

// Labels 1-op-1 overgenomen uit het tabblad "BIA & BIV-Classificatie"
const BANDS = [
  { key: 'vitaal' as const,   score: 1, label: 'Catastrofaal' },
  { key: 'hoog' as const,     score: 2, label: 'Kritiek / zeer ernstig' },
  { key: 'midden' as const,   score: 3, label: 'Gemiddeld' },
  { key: 'laag' as const,     score: 4, label: 'Gering' },
  { key: 'minimaal' as const, score: 5, label: 'Verwaarloosbaar' },
]

function BivDistPanel({
  title, dist, total,
}: {
  title: string
  dist: BivDimensionDistribution
  total: number
}) {
  const assessed = total - dist.not_assessed
  return (
    <div>
      {/* Header: dimensietitel + "Niet beoordeeld" badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none pt-0.5">
          {title}
        </p>
        <span className={clsx(
          'shrink-0 text-xs font-medium rounded-full px-2 py-0.5 border leading-none',
          dist.not_assessed > 0
            ? 'bg-amber-50 text-amber-600 border-amber-200'
            : 'bg-green-50 text-green-600 border-green-200',
        )}>
          Niet beoordeeld: {dist.not_assessed}/{total}
        </span>
      </div>

      {/* Classificatierijen */}
      <div className="space-y-2">
        {BANDS.map(({ key, score, label }) => {
          const count = dist[key]
          const pct = assessed > 0 ? Math.round((count / assessed) * 100) : 0
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-36 text-xs text-gray-500 shrink-0 truncate">{label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all', SCORE_BG[score])}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={clsx(
                'w-5 text-xs font-bold shrink-0 text-right tabular-nums',
                count > 0 && score <= 2 ? 'text-red-600' : 'text-gray-400',
              )}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Critical process table row ────────────────────────────────────────────────

function CriticalRow({ process }: { process: CriticalProcessRisk }) {
  const navigate = useNavigate()

  // Procesclassificatie = hoogste urgentie (laagste score) van B, I en V
  // Identiek aan highestSeverity() in biaShared.tsx
  const scores = [process.availability_score, process.integrity_score, process.confidentiality_score]
    .filter((s): s is number => s !== null && s > 0)
  const procesScore = scores.length ? Math.min(...scores) : null

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => navigate(`/processes/${process.id}`)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-400">{process.code}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-800 font-medium">
        <span className="block truncate">{process.name}</span>
      </td>
      <td className="px-4 py-3">
        <ScoreBadge score={procesScore} />
      </td>
    </tr>
  )
}

// ── Priority action row ───────────────────────────────────────────────────────

function ActionRow({ action }: { action: PriorityAction }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const priorityStyle = {
    critical: 'border-l-red-500 bg-red-50',
    high:     'border-l-orange-400 bg-orange-50',
    medium:   'border-l-gray-300 bg-white',
  }[action.priority]

  const dotColor = {
    critical: 'bg-red-500',
    high:     'bg-orange-400',
    medium:   'bg-gray-400',
  }[action.priority]

  return (
    <div className={clsx('border-l-4 rounded-r-lg mb-2 overflow-hidden', priorityStyle)}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={clsx('w-2 h-2 rounded-full shrink-0', dotColor)} />
          {open
            ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
            : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
          <span className="font-mono text-xs text-gray-400 shrink-0">{action.code}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{action.name}</span>
        </div>
        <span className="text-xs text-gray-500 shrink-0 ml-3">{action.reason}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-12">
          <ul className="space-y-1 mb-3">
            {action.missing_fields.map(f => (
              <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                <XCircle size={11} className="text-red-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/processes/${action.id}`) }}
            className="text-xs text-brand-600 hover:underline font-medium"
          >
            Ga naar proces →
          </button>
        </div>
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
  const { data: risk } = useQuery({
    queryKey: ['dashboard', 'risk-overview'],
    queryFn: dashboardApi.riskOverview,
  })
  const { data: reviewStatus } = useQuery({
    queryKey: ['dashboard', 'review-status'],
    queryFn: dashboardApi.reviewStatus,
  })

  const total = summary?.total_processes ?? 0
  const hasData = total > 0

  const dateStr = new Date().toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-6xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Security Posture Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{dateStr}</p>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard
          icon={Shield}
          iconColorClass="text-blue-400"
          title="BIA & BIV"
          pct={risk?.coverage.bia.pct ?? 0}
          count={risk?.coverage.bia.done ?? 0}
          total={total}
          singularLabel="proces beoordeeld"
          pluralLabel="processen beoordeeld"
        />
        <KpiCard
          icon={FileText}
          iconColorClass="text-indigo-400"
          title="Procescontext"
          pct={risk?.coverage.business_context.pct ?? 0}
          count={risk?.coverage.business_context.done ?? 0}
          total={total}
          singularLabel="proces ingevuld"
          pluralLabel="processen ingevuld"
        />
        <KpiCard
          icon={Database}
          iconColorClass="text-cyan-500"
          title="Applicaties"
          pct={risk?.coverage.applications.pct ?? 0}
          count={risk?.coverage.applications.done ?? 0}
          total={total}
          singularLabel="proces gekoppeld"
          pluralLabel="processen gekoppeld"
        />
        <KpiCard
          icon={CheckCircle2}
          iconColorClass="text-emerald-500"
          title="Compleetheid"
          pct={risk?.process_fields_coverage.pct ?? 0}
          count={risk?.process_fields_coverage.done ?? 0}
          total={total}
          singularLabel="procesinformatie compleet"
          pluralLabel="procesinformatie compleet"
        />
        <PrivacyInfoCard
          count={risk?.privacy_coverage.done ?? 0}
          total={total}
        />
      </div>

      {hasData && risk && (
        <>
          {/* ── BIV Distribution ── */}
          <Card>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">
              Risico-landschap — verdeling per BIV-dimensie
            </h2>
            <div className="grid grid-cols-3 gap-8">
              <BivDistPanel title="Beschikbaarheid" dist={risk.biv_distribution.availability} total={total} />
              <BivDistPanel title="Integriteit" dist={risk.biv_distribution.integrity} total={total} />
              <BivDistPanel title="Vertrouwelijkheid" dist={risk.biv_distribution.confidentiality} total={total} />
            </div>
          </Card>

          {/* ── Review Status ── */}
          <Card>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">
              Reviewmonitoring
            </h2>
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              <ReviewKpiPanel
                icon={GitBranch}
                iconColorClass="text-gray-500"
                title="Processen"
                pct={reviewStatus?.processes.pct ?? 0}
                count={reviewStatus?.processes.on_time ?? 0}
                total={reviewStatus?.processes.total ?? 0}
                label={`${reviewStatus?.processes.on_time ?? 0} ${(reviewStatus?.processes.on_time ?? 0) === 1 ? 'proces' : 'processen'} op tijd gereviewed`}
              />
              <ReviewKpiPanel
                icon={Database}
                iconColorClass="text-cyan-500"
                title="Applicaties"
                pct={reviewStatus?.applications.pct ?? 0}
                count={reviewStatus?.applications.on_time ?? 0}
                total={reviewStatus?.applications.total ?? 0}
                label={`${reviewStatus?.applications.on_time ?? 0} ${(reviewStatus?.applications.on_time ?? 0) === 1 ? 'applicatie' : 'applicaties'} op tijd gereviewed`}
              />
              <ReviewKpiPanel
                icon={Shield}
                iconColorClass="text-blue-400"
                title="BIA & BIV-Classificatie"
                pct={reviewStatus?.bia.pct ?? 0}
                count={reviewStatus?.bia.on_time ?? 0}
                total={reviewStatus?.bia.total ?? 0}
                label={`${reviewStatus?.bia.on_time ?? 0} ${(reviewStatus?.bia.on_time ?? 0) === 1 ? 'BIA' : "BIA's"} op tijd gereviewed`}
              />
              <ReviewKpiPanel
                icon={FileText}
                iconColorClass="text-indigo-400"
                title="Procescontext"
                pct={reviewStatus?.business_context.pct ?? 0}
                count={reviewStatus?.business_context.on_time ?? 0}
                total={reviewStatus?.business_context.total ?? 0}
                label={`${reviewStatus?.business_context.on_time ?? 0} ${(reviewStatus?.business_context.on_time ?? 0) === 1 ? 'procescontext' : 'procescontexten'} op tijd gereviewed`}
              />
            </div>
          </Card>

          {/* ── Critical processes ── */}
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Kritische processen
                <span className="ml-2 bg-red-100 text-red-600 rounded-full px-2 py-0.5 normal-case text-xs font-medium">
                  {risk.critical_processes.length}
                </span>
              </h2>
            </div>
            {risk.critical_processes.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-400 text-center">
                Geen kritische processen gedefinieerd.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-28" />
                    <col />
                    <col className="w-52" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Code</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Naam</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Procesclassificatie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {risk.critical_processes.map(p => (
                      <CriticalRow key={p.id} process={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Priority Actions ── */}
          {risk.priority_actions.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Prioritaire acties
                <span className="ml-2 bg-orange-100 text-orange-600 rounded-full px-2 py-0.5 normal-case text-xs font-medium">
                  {risk.priority_actions.length}
                </span>
              </h2>
              <div>
                {risk.priority_actions.map(a => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </div>
            </div>
          )}

          {risk.priority_actions.length === 0 && (
            <Card className="flex items-center gap-3 py-4 text-green-700">
              <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              <p className="text-sm font-medium">Alle processen zijn volledig gedocumenteerd.</p>
            </Card>
          )}
        </>
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
