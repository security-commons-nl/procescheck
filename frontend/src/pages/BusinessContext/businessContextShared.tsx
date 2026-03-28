/**
 * Shared read-only BusinessContext display component.
 * Used by ProcessDetail (Procescontext tab) to show business context results
 * without any editing capability. Layout and styling match BusinessContextPage exactly.
 */

import { useState, useEffect, useRef } from 'react'
import { Info } from 'lucide-react'
import type { BusinessContext } from '../../types'

// ── Canvas block config (identical to BusinessContextPage) ────────────────────

interface CanvasBlockDef {
  key: keyof BusinessContext
  label: string
  hint: string
  info: string[]
  gridArea: string
  color: string
  border: string
  titleColor: string
}

const CANVAS_BLOCKS: CanvasBlockDef[] = [
  {
    key: 'key_partners',
    label: 'Kern partners',
    hint: 'Met wie werken we samen in of rondom dit proces?',
    info: [
      "Welke ketenpartners zijn betrokken (bv. IBD, NCSC, RvIG, UWV, RDW, IND, CJIB etc.)?",
      "Werken we samen met andere gemeenten of leveranciers?",
      "Welke afspraken (SLA's, convenanten) zijn er?",
      "Zijn er wettelijke partnerschappen verplicht?",
      'Welke externe partijen zijn onmisbaar voor dit proces?',
      'Maakt het proces deel uit van een keten/meerdere ketens? (ketenpartners)',
    ],
    gridArea: 'kp',
    color: 'bg-teal-50',
    border: 'border-teal-200',
    titleColor: 'text-teal-800',
  },
  {
    key: 'key_activities',
    label: 'Kern activiteiten',
    hint: 'Wat doen we doelbewust om het proces uit te voeren?',
    info: [
      'Hoe leveren we kwaliteit bij dit proces?',
      'Wat wordt er vereist bij afwijking of nooduitvoering?',
      'Hoe is de monitoring of sturing geregeld?',
      'Kun je in twee of drie zinnen beschrijven wat dit proces doet en wat de output is?',
      'Wat is het doel van het proces?',
      'Waar begint het proces en waar eindigt het — wat is de trigger en wat is het eindresultaat?',
      'Hoe vaak wordt dit proces uitgevoerd?',
      'Zijn er piekperiodes waarin dit proces extra kritisch is?',
      'Zijn er deelprocessen of varianten (spoedprocedure etc.)?',
    ],
    gridArea: 'ka',
    color: 'bg-blue-50',
    border: 'border-blue-200',
    titleColor: 'text-blue-800',
  },
  {
    key: 'value_proposition',
    label: 'Waarde propositie',
    hint: 'Wat is de kern van het proces?',
    info: [
      'Welke waarde leveren we aan de samenleving of burger?',
      'Welk probleem lossen we op voor inwoners of maatschappelijke doelen?',
      'Hoe draagt dit proces bij aan maatschappelijke doelen?',
    ],
    gridArea: 'vp',
    color: 'bg-amber-50',
    border: 'border-amber-300',
    titleColor: 'text-amber-800',
  },
  {
    key: 'customer_relationships',
    label: 'Klant relaties',
    hint: 'Hoe is de relatie met burgers/klanten?',
    info: [
      'Is er sprake van zelfbediening of servicegerichtheid?',
      'Hoe zorgen we voor kwaliteit en tevredenheid?',
      'Hoe ziet de digitalisering van klantcontact eruit (bv. DigiD, e-formulieren)?',
    ],
    gridArea: 'kr',
    color: 'bg-violet-50',
    border: 'border-violet-200',
    titleColor: 'text-violet-800',
  },
  {
    key: 'customer_segments',
    label: 'Klant segmenten',
    hint: 'Voor wie verrichtten we het proces?',
    info: [
      'Wie zijn de klanten of doelgroepen (bv. inwoners, bedrijven, andere overheden)?',
      'Welk gebruik maken zij van dit gemeentelijke proces?',
      'Is het proces verplicht Zijn er verschillende doelgroepen met eigen behoeften?',
      'Bepalen bepaalde doelgroepen extra ondersteuning nodig?',
    ],
    gridArea: 'ks',
    color: 'bg-rose-50',
    border: 'border-rose-200',
    titleColor: 'text-rose-800',
  },
  {
    key: 'key_resources',
    label: 'Kern middelen',
    hint: 'Welke middelen zijn nodig om dit proces uit te voeren?',
    info: [
      'Welke hardware, informatiesystemen en applicaties zijn nodig?',
      'Welke automatisering of data zijn cruciaal?',
      'Welke mensen, locaties, vergunningen en bevoegdheden zijn vereist?',
      'Welke informatie wordt er gebruikt binnen het proces? (persoonsgegevens, financiële gegevens, etc.)',
    ],
    gridArea: 'km',
    color: 'bg-blue-50',
    border: 'border-blue-200',
    titleColor: 'text-blue-800',
  },
  {
    key: 'channels',
    label: 'Kanalen',
    hint: 'Hoe levert het proces de dienst aan de klant?',
    info: [
      'Welke communicatiekanalen worden gebruikt (post, app, balie, e-mail)?',
      'Hoe wordt geïnformeerd, aangevraagd, beoordeeld en geleverd?',
      'Hoe gaan klanten om met het proces?',
    ],
    gridArea: 'ch',
    color: 'bg-violet-50',
    border: 'border-violet-200',
    titleColor: 'text-violet-800',
  },
  {
    key: 'cost_structure',
    label: 'Kosten structuur',
    hint: 'Wat zijn de voornaamste kosten van dit proces?',
    info: [
      'Wat zijn de kosten voor personeel, licenties, infra en uitbesteding?',
      'Wat zijn de vaste en variabele kosten?',
      'Welke aspecten zijn het duurst?',
      'Zijn er bezuinigingsdoelen of taakstellingen van toepassing?',
    ],
    gridArea: 'ko',
    color: 'bg-orange-50',
    border: 'border-orange-200',
    titleColor: 'text-orange-800',
  },
  {
    key: 'key_aspects',
    label: 'Kern aspecten',
    hint: 'Welke wet- en regelgeving en overige aspecten zijn relevant?',
    info: [
      'Welke wet- en regelgeving is van toepassing op dit proces?',
      'Wat is de positie van dit proces in de keten?',
      'Welke continuïteitseisen gelden?',
      'Zijn er overige relevante aspecten (risico, compliance, AVG)?',
    ],
    gridArea: 'aspects',
    color: 'bg-slate-50',
    border: 'border-slate-200',
    titleColor: 'text-slate-700',
  },
  {
    key: 'revenue_streams',
    label: 'Inkomstenbronnen / Baten',
    hint: 'Welke baten levert het proces op?',
    info: [
      'Welke baten levert het proces op, financieel of maatschappelijk?',
      'Wordt waarde gecreëerd via samenwerking of ketensamenwerking?',
      'Zijn er besparingen door digitalisering van het proces?',
      "Draagt het bij aan beleidsdoelen of KPI's?",
    ],
    gridArea: 'ib',
    color: 'bg-green-50',
    border: 'border-green-200',
    titleColor: 'text-green-800',
  },
]

// ── Info popover (identical to BusinessContextPage) ───────────────────────────

function InfoPopover({ items, onClose }: { items: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-7 right-0 z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
    >
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-gray-600 leading-snug">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Read-only canvas block ────────────────────────────────────────────────────

function ReadOnlyCanvasBlock({
  def,
  value,
  openInfo,
  onToggleInfo,
}: {
  def: CanvasBlockDef
  value: string
  openInfo: boolean
  onToggleInfo: () => void
}) {
  return (
    <div
      style={{ gridArea: def.gridArea }}
      className={`${def.color} border ${def.border} rounded-lg p-3 flex flex-col relative`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className={`text-xs font-bold uppercase tracking-wide ${def.titleColor}`}>
          {def.label}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleInfo() }}
          className="ml-1 shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-black/5 transition-colors"
          title="Meer informatie"
        >
          <Info size={12} strokeWidth={1.75} />
        </button>
        {openInfo && <InfoPopover items={def.info} onClose={onToggleInfo} />}
      </div>
      <div className="text-xs text-gray-400 mb-2 leading-snug">{def.hint}</div>
      <div className="flex-1 w-full text-sm rounded p-1.5 bg-white/70 text-gray-700 whitespace-pre-wrap min-h-[88px] overflow-auto">
        {value || <span className="text-gray-300 italic text-xs">Niet ingevuld</span>}
      </div>
    </div>
  )
}

// ── Exported: BusinessContextReadOnly ─────────────────────────────────────────
// Renders the full business context canvas in read-only mode.
// Visually identical to BusinessContextPage canvas (same grid, same colors).

export function BusinessContextReadOnly({ bc }: { bc: BusinessContext }) {
  const [openInfo, setOpenInfo] = useState<string | null>(null)

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1.4fr 1fr 1fr',
          gridTemplateRows: 'auto auto auto',
          gridTemplateAreas: `
            "kp ka vp kr ks"
            "kp km vp ch ks"
            "ko ko aspects ib ib"
          `,
          gap: '8px',
        }}
      >
        {CANVAS_BLOCKS.map(b => (
          <ReadOnlyCanvasBlock
            key={b.key}
            def={b}
            value={(bc[b.key] as string) ?? ''}
            openInfo={openInfo === b.key}
            onToggleInfo={() => setOpenInfo(prev => (prev === b.key ? null : b.key))}
          />
        ))}
      </div>

      {/* Informatieverwerking (read-only) */}
      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500 shrink-0">
            Informatieverwerking
          </span>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={bc.personal_data === true}
              onChange={() => {}}
              className="w-4 h-4 border-gray-300 text-brand-600 pointer-events-none"
              tabIndex={-1}
            />
            <span className="text-sm text-gray-700">Verwerkt persoonsgegevens</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={bc.personal_data === false}
              onChange={() => {}}
              className="w-4 h-4 border-gray-300 text-brand-600 pointer-events-none"
              tabIndex={-1}
            />
            <span className="text-sm text-gray-700">Verwerkt geen persoonsgegevens</span>
          </label>
        </div>
        {bc.personal_data === true && (
          <div className="mt-2 pl-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bc.special_personal_data ?? false}
                onChange={() => {}}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 pointer-events-none"
                tabIndex={-1}
              />
              <span className="text-sm text-gray-700">Waaronder bijzondere persoonsgegevens</span>
            </label>
          </div>
        )}
      </div>
    </>
  )
}
