/**
 * Shared read-only BIA display components.
 * Used by ProcessDetail (BIA & BIV-Classificatie tab) to show BIA results
 * without any editing capability. All constants and logic match BiaPage exactly.
 */

import bcpTimelineImg from '../../assets/bcp-timeline.png'
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

// ── BCP compact map (identical to BiaPage) ────────────────────────────────────

const BCP_COMPACT_MAP = {
  mtpd: { 1: 'enkele uren niet acceptabel', 2: 'maximaal 8 uur',   3: 'maximaal 2 werkdagen', 4: 'maximaal 1 week',  5: 'langer dan een week' },
  rto:  { 1: 'binnen enkele uren',          2: 'binnen 8 uur',     3: 'binnen 2 werkdagen',   4: 'binnen een week',  5: 'langer dan een week' },
  wrt:  { 1: 'meerdere werkdagen',           2: '1 werkdag',        3: '4–8 uur',              4: '1–4 uur',          5: 'minder dan 1 uur'    },
  rpo:  { 1: 'enkele uren',                  2: '4–8 uur',          3: '8–24 uur',             4: 'maximaal 24 uur',  5: 'een week of meer'    },
} as const

// ── BCP answer info texts (copied from BiaPage B_QUESTIONS[4–7].answers.info) ─

const BCP_INFO: Record<'b5' | 'b6' | 'b7' | 'b8', Record<number, string>> = {
  b5: {
    1: 'Uitval van enkele uren is niet acceptabel en kan leiden tot onherstelbare schade en bestuurlijke crisis.',
    2: 'Uitval van maximaal 8 uur kan cruciale processen stilleggen en leidt tot brede maatschappelijke en bestuurlijke gevolgen.',
    3: 'Uitval van maximaal 2 werkdagen heeft aanzienlijke invloed op de dienstverlening en kan leiden tot klachten.',
    4: 'Uitval van maximaal 1 week leidt tot hinder maar heeft geen aanzienlijke invloed op de dienstverlening.',
    5: 'Uitval van meer dan een week kan zonder merkbare schade worden opgevangen. Geen voelbare impact voor burgers of bestuur.',
  },
  b6: {
    1: 'Binnen enkele uren: Near real-time herstel vereist. Elke vertraging leidt tot onherstelbare schade.',
    2: 'Binnen 8 uur: Herstel binnen 8 uur is noodzakelijk om stillegging proces te voorkomen.',
    3: 'Binnen 2 werkdagen: Herstel binnen 2 werkdagen voorkomt aanzienlijke verstoring van kernactiviteiten.',
    4: 'Binnen 1 week: Herstel binnen een week voorkomt aanzienlijke hinder aan de dienstverlening.',
    5: 'Meer dan 1 week: Herstel binnen een week is voldoende. Geen merkbare impact bij langere uitval.',
  },
  b7: {
    1: 'Meerdere werkdagen: Zeer omvangrijk herstelwerk. Volledig operationeel worden vergt meerdere dagen intensieve inspanning.',
    2: '1 werkdag: Omvangrijk herstelwerk. Significante capaciteit en tijd nodig om volledig te herstellen.',
    3: 'Dagdeel (4–8 uur): Merkbaar herstelwerk vereist. Achterstand vraagt gerichte inzet van medewerkers.',
    4: '1–4 uur: Beperkt herstelwerk. Achterstand is snel weggewerkt met beschikbare capaciteit.',
    5: 'Minder dan 1 uur: Nauwelijks herstelwerk nodig. Proces draait direct na systeemherstel weer volledig.',
  },
  b8: {
    1: 'Enkele uren of minder: Dataverlies van enkele uren kan leiden tot onherstelbare schade en bestuurlijke crisis. Near real-time back-up vereist.',
    2: '4–8 uur: Dataverlies van 4 tot 8 uur kan proces stilleggen. Informatie is moeilijk te reconstrueren.',
    3: '8–24 uur: Dataverlies van 8 tot 24 uur heeft aanzienlijke invloed op de dienstverlening en kernactiviteiten.',
    4: 'Maximaal 24 uur: Dataverlies van maximaal 24 uur leidt tot hinder maar heeft geen aanzienlijke invloed op de dienstverlening.',
    5: '1 week of meer: Dataverlies van een week of langer kan zonder merkbare schade worden opgevangen. Informatie is eenvoudig te reconstrueren.',
  },
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function BcpValueDisplay({ value }: { value: string | undefined }) {
  if (!value) {
    return (
      <div className="flex items-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 min-h-[36px]">
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

function BcpTimeline({ mtpd, rto, wrt, rpo }: { mtpd?: string; rto?: string; wrt?: string; rpo?: string }) {
  const dash = '—'
  const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : dash)
  const base: React.CSSProperties = {
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
  return (
    <div className="relative w-full" style={{ lineHeight: 0 }}>
      <img
        src={bcpTimelineImg}
        alt="Business Continuity tijdlijn: Business As Usual → Dataverlies → Systeemuitval → Hervatting Productie → Business As Usual"
        className="w-full h-auto block"
        draggable={false}
      />
      <span style={{ ...base, left: '59.5%', top: '14.9%' }}>{cap(mtpd)}</span>
      <span style={{ ...base, left: '28.8%', top: '42.5%' }}>{cap(rpo)}</span>
      <span style={{ ...base, left: '50.0%', top: '42.5%' }}>{cap(rto)}</span>
      <span style={{ ...base, left: '71.8%', top: '42.5%' }}>{cap(wrt)}</span>
    </div>
  )
}

function RoField({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 leading-snug min-h-[36px]">
        {value || <span className="text-gray-400">—</span>}
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
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Procesclassificatie
          </div>
          <div className={`text-base font-bold ${procScore ? SCORE_STRIP_TEXT[procScore] : 'text-gray-400'}`}>
            {procScore ? SCORE_LABELS[procScore] : 'Nog niet bepaald'}
          </div>
        </div>
      </div>

      {/* Hierarchy connector */}
      <div className="flex flex-col items-center py-1">
        <div className="w-px h-3 bg-gray-300" />
        <ChevronDown size={13} className="text-gray-300 -mt-0.5" />
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
  const b5 = bia.b5_score
  const b6 = bia.b6_score
  const b7 = bia.b7_score
  const b8 = bia.b8_score

  return (
    <>
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
          Business Continuity Parameters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RoBcpField label="MTPD / MTD">
            <BcpValueDisplay value={b5 ? BCP_INFO.b5[b5] : undefined} />
          </RoBcpField>
          <RoBcpField label="RTO">
            <BcpValueDisplay value={b6 ? BCP_INFO.b6[b6] : undefined} />
          </RoBcpField>
          <RoBcpField label="WRT">
            <BcpValueDisplay value={b7 ? BCP_INFO.b7[b7] : undefined} />
          </RoBcpField>
          <RoBcpField label="RPO">
            <BcpValueDisplay value={b8 ? BCP_INFO.b8[b8] : undefined} />
          </RoBcpField>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-100">
          <BcpTimeline
            mtpd={b5 ? BCP_COMPACT_MAP.mtpd[b5 as keyof typeof BCP_COMPACT_MAP.mtpd] : undefined}
            rto={b6  ? BCP_COMPACT_MAP.rto[b6  as keyof typeof BCP_COMPACT_MAP.rto]  : undefined}
            wrt={b7  ? BCP_COMPACT_MAP.wrt[b7  as keyof typeof BCP_COMPACT_MAP.wrt]  : undefined}
            rpo={b8  ? BCP_COMPACT_MAP.rpo[b8  as keyof typeof BCP_COMPACT_MAP.rpo]  : undefined}
          />
        </div>
      </Card>
    </>
  )
}
