import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { processesApi } from '../../api/processes'
import { businessContextApi } from '../../api/businessContext'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Maximize2, Minimize2, Info, X } from 'lucide-react'
import type { BusinessContext } from '../../types'

// ── Canvas block config ───────────────────────────────────────────────────────

interface CanvasBlockDef {
  key: keyof BusinessContext
  label: string
  hint: string        // short — one sentence shown in UI
  info: string[]      // detailed bullets shown in popover
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

// ── Info popover ──────────────────────────────────────────────────────────────

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

// ── Block focus modal ─────────────────────────────────────────────────────────

function BlockFocusModal({
  def,
  value,
  onChange,
  onClose,
}: {
  def: CanvasBlockDef
  value: string
  onChange: (v: string) => void
  onClose: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <style>{`
        @keyframes blockFocusIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={e => { if (e.target === backdropRef.current) onClose() }}
      >
        <div
          className={`${def.color} border ${def.border} rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 flex flex-col`}
          style={{ animation: 'blockFocusIn 0.15s ease-out' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className={`text-sm font-bold uppercase tracking-wide ${def.titleColor}`}>{def.label}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-snug">{def.hint}</div>
            </div>
            <button
              onClick={onClose}
              className="ml-2 shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-black/10 transition-colors"
              title="Sluiten"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            rows={10}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400 rounded-lg p-3 resize-y bg-white/80"
          />
        </div>
      </div>
    </>
  )
}

// ── Canvas block component ────────────────────────────────────────────────────

function CanvasBlock({
  def,
  value,
  onChange,
  fullscreen,
  openInfo,
  onToggleInfo,
  onOpenFocus,
}: {
  def: CanvasBlockDef
  value: string
  onChange: (v: string) => void
  fullscreen: boolean
  openInfo: boolean
  onToggleInfo: () => void
  onOpenFocus: () => void
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
      <textarea
        rows={fullscreen ? 6 : 4}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 w-full text-sm border-0 focus:outline-none focus:ring-1 focus:ring-brand-400 rounded p-1.5 resize-none bg-white/70"
      />
      <button
        onClick={e => { e.stopPropagation(); onOpenFocus() }}
        className="absolute bottom-2 right-2 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-black/5 transition-colors"
        title="Vergroot blok"
      >
        <Maximize2 size={11} strokeWidth={1.75} />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BusinessContextPage() {
  const { processId } = useParams<{ processId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedPid, setSelectedPid] = useState<number | undefined>(
    processId ? Number(processId) : undefined,
  )
  const [form, setForm] = useState<Partial<BusinessContext>>({})
  const [fullscreen, setFullscreen] = useState(false)
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const [focusBlock, setFocusBlock] = useState<string | null>(null)

  const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => processesApi.list() })
  const pid = selectedPid

  const { data: existing } = useQuery({
    queryKey: ['business-context', pid],
    queryFn: () => businessContextApi.get(pid!),
    enabled: !!pid,
    retry: false,
  })

  const current: Partial<BusinessContext> = existing ? { ...existing, ...form } : form
  const setStr = (k: keyof BusinessContext, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setBool = (k: keyof BusinessContext, v: boolean) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => businessContextApi.upsert(pid!, current),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-context', pid] })
      qc.invalidateQueries({ queryKey: ['processes'] })
      setForm({})
    },
  })

  const personalData = current.personal_data ?? false
  const specialPersonalData = current.special_personal_data ?? false

  const canvasContent = (
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
          <CanvasBlock
            key={b.key}
            def={b}
            value={current[b.key] as string ?? ''}
            onChange={v => setStr(b.key, v)}
            fullscreen={fullscreen}
            openInfo={openInfo === b.key}
            onToggleInfo={() => setOpenInfo(prev => prev === b.key ? null : b.key)}
            onOpenFocus={() => setFocusBlock(b.key)}
          />
        ))}
      </div>

      {/* Informatieverwerking */}
      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500 shrink-0">
            Informatieverwerking
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`personal_data_${pid}`}
              checked={current.personal_data === true}
              onChange={() => setBool('personal_data', true)}
              className="w-4 h-4 border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700">Verwerkt persoonsgegevens</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`personal_data_${pid}`}
              checked={current.personal_data === false}
              onChange={() => {
                setBool('personal_data', false)
                setBool('special_personal_data', false)
              }}
              className="w-4 h-4 border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700">Verwerkt geen persoonsgegevens</span>
          </label>
        </div>
        {current.personal_data === true && (
          <div className="mt-2 pl-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={specialPersonalData}
                onChange={e => setBool('special_personal_data', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">Waaronder bijzondere persoonsgegevens</span>
            </label>
          </div>
        )}
      </div>

    </>
  )

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processen</div>
          <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
            {processes.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => { setSelectedPid(p.id); setForm({}); navigate(`/business-context/${p.id}`) }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    pid === p.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-1">
                    <span>{p.code}</span>
                    {p.has_business_context && <span className="text-green-500">✓</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <PageHeader
          title="Procescontext"
          subtitle={pid ? processes.find(p => p.id === pid)?.name : 'Selecteer een proces'}
          actions={
            pid ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullscreen(f => !f)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                >
                  {fullscreen
                    ? <><Minimize2 size={14} /> Verkleinen</>
                    : <><Maximize2 size={14} /> Vergroot canvas</>}
                </button>
                <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Opslaan</Button>
              </div>
            ) : undefined
          }
        />

        {!pid && (
          <div className="bg-white border border-gray-200 rounded-xl text-center py-12 text-gray-400">
            Selecteer een proces aan de linkerkant.
          </div>
        )}

        {pid && (() => {
          const cutoff = new Date()
          cutoff.setFullYear(cutoff.getFullYear() - 1)
          const reviewDate = current.review_date ? new Date(current.review_date) : null
          const isExpired = reviewDate !== null && reviewDate < cutoff
          return (
            <div className="mb-3 bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500 shrink-0">
                Laatste review datum
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={current.review_date ?? ''}
                  onChange={e => setStr('review_date', e.target.value)}
                  className={[
                    'h-8 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2',
                    isExpired
                      ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-300'
                      : reviewDate
                        ? 'border-green-300 bg-green-50 text-green-700 focus:ring-green-300'
                        : 'border-gray-200 bg-white text-gray-700 focus:ring-brand-300',
                  ].join(' ')}
                />
                {isExpired && (
                  <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                    Review verlopen
                  </span>
                )}
              </div>
            </div>
          )
        })()}

        {pid && !fullscreen && canvasContent}
      </div>

      {focusBlock && (() => {
        const def = CANVAS_BLOCKS.find(b => b.key === focusBlock)!
        return (
          <BlockFocusModal
            def={def}
            value={current[def.key] as string ?? ''}
            onChange={v => setStr(def.key, v)}
            onClose={() => setFocusBlock(null)}
          />
        )
      })()}

      {pid && fullscreen && (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-auto">
          <div className="max-w-screen-2xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Procescontext</h1>
                <p className="text-sm text-gray-500">{processes.find(p => p.id === pid)?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Minimize2 size={14} /> Verkleinen
                </button>
                <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Opslaan</Button>
              </div>
            </div>
            {canvasContent}
          </div>
        </div>
      )}
    </div>
  )
}
