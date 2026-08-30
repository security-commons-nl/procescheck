/**
 * Shared read-only BIA display components.
 * Used by ProcessDetail (BIA & BIV-Classificatie tab) to show BIA results
 * without any editing capability. All constants and logic match BiaPage exactly.
 */

import itContinueiteitImg from '../../assets/it-continuiteit.png'
import businessContinueiteitImg from '../../assets/business-continuiteit.png'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { ScoreBadge } from '../../components/common/Badge'
import type { BiaAssessment } from '../../types'

// ── Score display maps (identical to BiaPage) ─────────────────────────────────

const SCORE_LABELS: Record<number, string> = {
  1: 'Catastrofaal',
  2: 'Kritiek / zeer ernstig',
  3: 'Gemiddeld',
  4: 'Gering',
  5: 'Verwaarloosbaar',
}

const SCORE_STRIP_BG: Record<number, string> = {
  1: 'bg-red-50', 2: 'bg-orange-50', 3: 'bg-yellow-50', 4: 'bg-blue-50', 5: 'bg-green-50',
}

const SCORE_STRIP_TEXT: Record<number, string> = {
  1: 'text-red-700', 2: 'text-orange-700', 3: 'text-yellow-700', 4: 'text-blue-700', 5: 'text-green-700',
}

// ── highestSeverity (identical to BiaPage) ────────────────────────────────────

function highestSeverity(scores: (number | undefined)[]): number | undefined {
  const valid = scores.filter((s): s is number => s !== undefined && s !== null && s > 0)
  return valid.length ? Math.min(...valid) : undefined
}

// ── Continuïteitsparameter-labels per score ───────────────────────────────────
// Mapping vragenlijst → parameters: b1 (max. uitvalduur) → RTO,
// b2 (max. dataverlies) → RPO, b3 (herstelwerk) → WRT, b4 (totale uitval) → MTPD/MTD.
// Gedeeld met BiaPage zodat invulscherm en read-only weergave identiek zijn.

export const PARAM_MAP = {
  rto: { 1: 'Enkele uren', 2: 'Maximaal 8 uur', 3: 'Maximaal 2 werkdagen', 4: 'Maximaal 1 week', 5: 'Meer dan een week' },
  rpo: { 1: 'Enkele uren', 2: '4 tot 8 uur', 3: '8 tot 24 uur', 4: 'Maximaal 24 uur', 5: 'Een week of meer' },
  wrt: { 1: 'Enkele uren', 2: '4 tot 8 uur', 3: '2 werkdagen', 4: '1 week', 5: 'Meer dan een week' },
  mtd: { 1: 'Enkele uren', 2: '4 tot 8 uur', 3: '2 werkdagen', 4: '1 week', 5: 'Meer dan een week' },
} as const

export function paramLabel(map: Record<number, string>, score?: number | null): string | undefined {
  if (score == null || score < 1 || score > 5) return undefined
  return map[score]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function BcpValueDisplay({ value }: { value: string | undefined }) {
  if (!value) {
    return (
      <div className="flex items-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-ink-subtle min-h-[36px]">
        Nog niet bepaald
      </div>
    )
  }
  return (
    <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 leading-snug min-h-[36px]">
      {value}
    </div>
  )
}

// Gedeelde stijl voor de labels die over de tijdlijn-afbeelding heen liggen.
const timelineLabelBase: React.CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  whiteSpace: 'nowrap',
  fontSize: '0.7rem',
  fontWeight: 700,
  lineHeight: 1,
  color: '#1a1a1a',
  pointerEvents: 'none',
  userSelect: 'none',
}
const timelineCap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—')

// IT-Continuïteit tijdlijn: toont alleen RPO en RTO. Calibratie identiek aan BiaPage.
function ItContinueitTimeline({ rto, rpo }: { rto?: string; rpo?: string }) {
  return (
    <div className="relative w-full" style={{ lineHeight: 0 }}>
      <img
        src={itContinueiteitImg}
        alt="IT-Continuïteit tijdlijn: RPO en RTO"
        className="w-full h-auto block"
        draggable={false}
      />
      <span style={{ ...timelineLabelBase, left: '28.8%', top: '42.5%' }}>{timelineCap(rpo)}</span>
      <span style={{ ...timelineLabelBase, left: '50.1%', top: '42.5%' }}>{timelineCap(rto)}</span>
    </div>
  )
}

// Business Continuïteit tijdlijn: toont RPO, RTO, WRT en MTD. Calibratie identiek aan BiaPage.
function BcContinueitTimeline({ rpo, rto, wrt, mtd }: { rpo?: string; rto?: string; wrt?: string; mtd?: string }) {
  return (
    <div className="relative w-full" style={{ lineHeight: 0 }}>
      <img
        src={businessContinueiteitImg}
        alt="Business Continuïteit tijdlijn"
        className="w-full h-auto block"
        draggable={false}
      />
      <span style={{ ...timelineLabelBase, left: '59.5%', top: '14.9%' }}>{timelineCap(mtd)}</span>
      <span style={{ ...timelineLabelBase, left: '28.8%', top: '42.5%' }}>{timelineCap(rpo)}</span>
      <span style={{ ...timelineLabelBase, left: '50.1%', top: '42.5%' }}>{timelineCap(rto)}</span>
      <span style={{ ...timelineLabelBase, left: '71.8%', top: '42.5%' }}>{timelineCap(wrt)}</span>
    </div>
  )
}

function RoField({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 leading-snug min-h-[36px]">
        {value || <span className="text-ink-subtle">—</span>}
      </div>
    </div>
  )
}

function RoBcpField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      {children}
    </div>
  )
}

// ── Exported: BiaScoreSummary ─────────────────────────────────────────────────
// Renders the Procesclassificatie strip + B/I/V score cards (read-only).
// Visually identical to the score summary block in BiaPage.

export function BiaScoreSummary({
  availabilityScore,
  integrityScore,
  confidentialityScore,
}: {
  availabilityScore?: number | null
  integrityScore?: number | null
  confidentialityScore?: number | null
}) {
  const procScore = highestSeverity([
    availabilityScore ?? undefined,
    integrityScore ?? undefined,
    confidentialityScore ?? undefined,
  ])

  const subScores = [
    { abbr: 'B', label: 'Beschikbaarheid',   score: availabilityScore   ?? undefined },
    { abbr: 'I', label: 'Integriteit',        score: integrityScore      ?? undefined },
    { abbr: 'V', label: 'Vertrouwelijkheid',  score: confidentialityScore ?? undefined },
  ]

  return (
    <div className="mb-4">
      {/* Procesclassificatie strip */}
      <div className={`rounded-xl border border-gray-200 shadow-sm overflow-hidden ${procScore ? SCORE_STRIP_BG[procScore] : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center py-4 px-6 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-subtle mb-1.5">
            Procesclassificatie
          </div>
          <div className={`text-base font-bold ${procScore ? SCORE_STRIP_TEXT[procScore] : 'text-ink-subtle'}`}>
            {procScore ? SCORE_LABELS[procScore] : 'Nog niet bepaald'}
          </div>
        </div>
      </div>

      {/* Hierarchy connector */}
      <div className="flex flex-col items-center py-1">
        <div className="w-px h-3 bg-gray-300" />
        <ChevronDown size={13} className="text-ink-subtle -mt-0.5" />
      </div>

      {/* B / I / V cards */}
      <div className="grid grid-cols-3 gap-3">
        {subScores.map(({ abbr, label, score }) => (
          <div key={abbr} className="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col items-center py-4 px-3 text-center">
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center mb-2">
              {abbr}
            </div>
            <div className="text-xs text-gray-500 mb-3 leading-tight">{label}</div>
            <ScoreBadge score={score} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Exported: BiaAlgemeenReadOnly ─────────────────────────────────────────────
// Renders the "Algemeen" section (interviewer, datum, notities) and Business
// Continuity Parameters (MTPD, RTO, WRT, RPO + timeline) in read-only mode.
// Visually matches the "Algemeen" tab in BiaPage.

export function BiaAlgemeenReadOnly({ bia }: { bia: BiaAssessment }) {
  const [scope, setScope] = useState<'IT-Continuïteit' | 'Business Continuïteit'>('IT-Continuïteit')

  // b1–b4 zijn de vragen die het BIA-formulier daadwerkelijk invult:
  // b1 → RTO, b2 → RPO, b3 → WRT, b4 → MTPD/MTD
  const rto = paramLabel(PARAM_MAP.rto, bia.b1_score)
  const rpo = paramLabel(PARAM_MAP.rpo, bia.b2_score)
  const wrt = paramLabel(PARAM_MAP.wrt, bia.b3_score)
  const mtd = paramLabel(PARAM_MAP.mtd, bia.b4_score)

  return (
    <>
      {/* Scope-schakelaar: identiek aan de invulpagina (BiaPage) */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scope</span>
        <div className="relative flex items-center bg-gray-100 rounded-full p-0.5">
          {(['IT-Continuïteit', 'Business Continuïteit'] as const).map(option => (
            <button
              key={option}
              onClick={() => setScope(option)}
              className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                scope === option
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RoField label="Interviewer" value={bia.interviewer_name} />
          <RoField
            label="Interviewdatum"
            value={bia.interview_date
              ? new Date(bia.interview_date).toLocaleDateString('nl-NL')
              : undefined}
          />
          <RoField label="Notities" value={bia.notes} full />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Continuïteitsparameters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RoBcpField label="RTO – Max. uitvalduur">
            <BcpValueDisplay value={rto} />
          </RoBcpField>
          <RoBcpField label="RPO – Max. dataverlies">
            <BcpValueDisplay value={rpo} />
          </RoBcpField>
          {scope === 'Business Continuïteit' && (
            <>
              <RoBcpField label="WRT – Herstelwerkzaamheden">
                <BcpValueDisplay value={wrt} />
              </RoBcpField>
              <RoBcpField label="MTPD / MTD – Totale uitvalduur">
                <BcpValueDisplay value={mtd} />
              </RoBcpField>
            </>
          )}
        </div>
        <div className="mt-8 pt-8 border-t border-gray-100">
          {scope === 'IT-Continuïteit' ? (
            <ItContinueitTimeline rto={rto} rpo={rpo} />
          ) : (
            <BcContinueitTimeline rpo={rpo} rto={rto} wrt={wrt} mtd={mtd} />
          )}
        </div>
      </Card>
    </>
  )
}
