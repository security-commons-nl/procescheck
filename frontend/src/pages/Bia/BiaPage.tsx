import bcpTimelineImg from '../../assets/bcp-timeline.png'
import itContinueiteitImg from '../../assets/it-continuiteit.png'
import businessContinueiteitImg from '../../assets/business-continuiteit.png'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, ChevronDown } from 'lucide-react'
import { processesApi } from '../../api/processes'
import { biaApi } from '../../api/bia'
import PageHeader from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { FormField, Input, Textarea } from '../../components/common/FormField'
import { ScoreBadge } from '../../components/common/Badge'
import type { BiaAssessment } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type AnswerOption = {
  label: string
  info: string
}

type BiaQuestion = {
  key: string
  label: string
  tooltip?: string  // gray toelichting text from Excel; shown via i-icon
  answers: AnswerOption[]
}

// ── Answer labels (5 fixed) ───────────────────────────────────────────────────

const ANSWER_LABELS = ['Catastrofaal', 'Kritiek / zeer ernstig', 'Gemiddeld', 'Gering', 'Verwaarloosbaar']

// ── Beschikbaarheid questions (Template BIA & BIV-Classificatie.xlsx) ────────

const B_QUESTIONS: BiaQuestion[] = [
  {
    key: 'b1',
    label: 'Wat is de maximale uitvalduur van het proces voordat onaanvaardbare gevolgen optreden?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Uitval van enkele uren is niet acceptabel en kan leiden tot onherstelbare schade en bestuurlijke crisis. De informatie is onvervangbaar en de processen die ermee samenhangen zijn vitaal voor de samenleving. Continuïteit moet permanent worden gewaarborgd. Near real-time beschikbaarheid is noodzakelijk. Uitval raakt direct de kern van de organisatie en kan het vertrouwen van burgers en bestuur onherstelbaar aantasten.' },
      { label: ANSWER_LABELS[1], info: 'Een dataverlies van 4 tot 8 uur of een systeemuitval van maximaal 8 uur kan strategische processen stilleggen. De informatie is moeilijk te vervangen en herstel vergt veel tijd, middelen en geld. De gevolgen worden breed gevoeld, zowel in de organisatie als daarbuiten, en kunnen leiden tot forse maatschappelijke ontwrichting en bestuurlijke druk.' },
      { label: ANSWER_LABELS[2], info: 'Een dataverlies van 8 tot 24 uur of een systeemuitval van maximaal 2 werkdagen heeft aanzienlijke invloed op kernactiviteiten en kan leiden tot klachten of verminderde dienstverlening. Het herstel van de informatie of systemen vergt aanzienlijke inspanning en brengt extra kosten met zich mee. De maatschappelijke impact wordt zichtbaar, maar met voldoende inzet in herstel nog goed mogelijk.' },
      { label: ANSWER_LABELS[3], info: 'Een dataverlies van maximaal 24 uur of een systeemuitval van maximaal 1 week kan leiden tot hinder in processen, maar de dienstverlening blijft grotendeels doorgaan. Herstel vraagt wel enige inspanning en planning, maar is goed uitvoerbaar. Voor burgers is er beperkte merkbare overlast en het vertrouwen in de organisatie blijft in stand.' },
      { label: ANSWER_LABELS[4], info: 'Een dataverlies van een week of meer of een systeemuitval die oploopt tot meer dan een week kan zonder merkbare schade worden opgevangen. Kernactiviteiten blijven doorgaan, hooguit met lichte vertraging, en de informatie kan eenvoudig worden vervangen of hersteld. Voor burgers of bestuurders is er geen voelbare impact en de continuïteit van de organisatie komt niet in gevaar.' },
    ],
  },
  {
    key: 'b2',
    label: 'Wat is de maximale hoeveelheid dataverlies die acceptabel is zonder onaanvaardbare gevolgen?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Uitval van enkele uren is niet acceptabel en kan leiden tot onherstelbare schade en bestuurlijke crisis. De informatie is onvervangbaar en de processen die ermee samenhangen zijn vitaal voor de samenleving. Continuïteit moet permanent worden gewaarborgd. Near real-time beschikbaarheid is noodzakelijk. Uitval raakt direct de kern van de organisatie en kan het vertrouwen van burgers en bestuur onherstelbaar aantasten.' },
      { label: ANSWER_LABELS[1], info: 'Een dataverlies van 4 tot 8 uur of een systeemuitval van maximaal 8 uur kan strategische processen stilleggen. De informatie is moeilijk te vervangen en herstel vergt veel tijd, middelen en geld. De gevolgen worden breed gevoeld, zowel in de organisatie als daarbuiten, en kunnen leiden tot forse maatschappelijke ontwrichting en bestuurlijke druk.' },
      { label: ANSWER_LABELS[2], info: 'Een dataverlies van 8 tot 24 uur of een systeemuitval van maximaal 2 werkdagen heeft aanzienlijke invloed op kernactiviteiten en kan leiden tot klachten of verminderde dienstverlening. Het herstel van de informatie of systemen vergt aanzienlijke inspanning en brengt extra kosten met zich mee. De maatschappelijke impact wordt zichtbaar, maar met voldoende inzet in herstel nog goed mogelijk.' },
      { label: ANSWER_LABELS[3], info: 'Een dataverlies van maximaal 24 uur of een systeemuitval van maximaal 1 week kan leiden tot hinder in processen, maar de dienstverlening blijft grotendeels doorgaan. Herstel vraagt wel enige inspanning en planning, maar is goed uitvoerbaar. Voor burgers is er beperkte merkbare overlast en het vertrouwen in de organisatie blijft in stand.' },
      { label: ANSWER_LABELS[4], info: 'Een dataverlies van een week of meer of een systeemuitval die oploopt tot meer dan een week kan zonder merkbare schade worden opgevangen. Kernactiviteiten blijven doorgaan, hooguit met lichte vertraging, en de informatie kan eenvoudig worden vervangen of hersteld. Voor burgers of bestuurders is er geen voelbare impact en de continuïteit van de organisatie komt niet in gevaar.' },
    ],
  },
]

// ── Integriteit questions (Template BIA & BIV-Classificatie.xlsx) ─────────────

const I_QUESTIONS: BiaQuestion[] = [
  {
    key: 'i1',
    label: 'Wat is de impact wanneer informatie onjuist, onvolledig of gemanipuleerd is?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Verkeerde of misleidende informatie veroorzaakt structurele fouten in management- en beleidsbeslissingen. Grootschalige fraude wordt mogelijk en strategische processen worden langdurig onderbroken of zelfs volledig lamgelegd. Het vertrouwen van burgers, partners en medewerkers gaat blijvend verloren. De organisatie wordt geconfronteerd met zware juridische aansprakelijkheid en extreme herstelkosten. Het moreel van medewerkers wordt ernstig geschaad, waardoor motivatie en loyaliteit verdwijnen. Herstel is nauwelijks nog mogelijk en de schade is grotendeels onomkeerbaar.' },
      { label: ANSWER_LABELS[1], info: 'Beslissingen van management of bestuur worden sterk beïnvloed door verkeerde informatie, waardoor de koers van de organisatie ernstig kan ontsporen. Fraude is aannemelijk en kan omvangrijk zijn. Kernprocessen komen grotendeels stil te liggen en het vertrouwen van burgers en ketenpartners krijgt forse en blijvende schade. Juridische claims zijn waarschijnlijk en de bijkomende kosten lopen hoog op. Het moreel van medewerkers komt zwaar onder druk te staan. Herstel is zeer moeilijk en vergt langdurige inspanningen.' },
      { label: ANSWER_LABELS[2], info: 'Managementbeslissingen kunnen duidelijk worden beïnvloed door onjuiste informatie, wat kan leiden tot verkeerd beleid of onjuiste keuzes. Het risico op fraude is significant en kernprocessen kunnen aanzienlijke vertraging oplopen. Burgers en ketenpartners verliezen merkbaar vertrouwen in de dienstverlening. Er zijn reële juridische risico\'s en de extra kosten om te herstellen zijn aanzienlijk. Medewerkers ervaren een daling in motivatie doordat fouten en herstelwerk druk veroorzaken. Herstel is mogelijk, maar kostbaar en tijdsintensief.' },
      { label: ANSWER_LABELS[3], info: 'Beslissingen kunnen incidenteel worden beïnvloed, maar niet op een manier die de organisatie langdurig schaadt. Het risico op fraude is aanwezig, maar beperkt in omvang. Processen ondervinden hooguit kortdurende hinder en het vertrouwen van burgers of ketenpartners wordt slechts licht geraakt. Juridische of financiële gevolgen zijn minimaal en eenvoudig op te vangen. Medewerkers merken weinig en herstel is relatief eenvoudig en snel uit te voeren.' },
      { label: ANSWER_LABELS[4], info: 'Managementbeslissingen blijven correct, omdat de betrouwbaarheid van de gegevens niet wordt aangetast. Het risico op fraude is verwaarloosbaar en de processen blijven ongestoord functioneren. Het vertrouwen van burgers, ketenpartners en medewerkers blijft intact. Er zijn geen juridische consequenties of extra kosten te verwachten en het moreel van de medewerkers ondervindt geen enkele negatieve invloed.' },
    ],
  },
]

// ── Vertrouwelijkheid questions (Template BIA & BIV-Classificatie.xlsx) ───────

const V_QUESTIONS: BiaQuestion[] = [
  {
    key: 'v1',
    label: 'Wat is de impact op de organisatie als informatie ongeautoriseerd wordt ingezien of verspreid?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Geheim/zeer geheim: Dit is de hoogste vertrouwelijkheidsklasse en geldt voor informatie waarvan openbaarmaking catastrofale gevolgen heeft voor de samenleving of de nationale veiligheid. Ongeautoriseerde kennisname is volledig onacceptabel. Het verlies van deze informatie zou vitale belangen direct in gevaar brengen en kan leiden tot ernstige maatschappelijke ontwrichting of crisis. Beveiliging op dit niveau is zeer zwaar en strikt gereguleerd (ABDO/ABRO), vaak in combinatie met intensief toezicht door bevoegde veiligheidsdiensten. Dit niveau komt bij gemeenten zeer waarschijnlijk niet voor.' },
      { label: ANSWER_LABELS[1], info: 'Confidentieel: Dit betreft informatie die van zo\'n grote gevoeligheid is dat openbaarmaking ernstig schadelijk zou zijn. Ongeautoriseerde kennisname moet actief en strikt worden voorkomen. De gevolgen zijn groot: blijvende schade aan vertrouwen in de overheid, aanzienlijke juridische claims en hoge herstelkosten. Op dit niveau gelden altijd aanvullende beveiligingsregels (ABDO/ABRO). BIO2 alleen is niet voldoende, omdat hier nationale veiligheid en staatsbelangen in het geding zijn.' },
      { label: ANSWER_LABELS[2], info: 'Vertrouwelijk: Bij dit niveau gaat het om informatie die gevoeliger is en waarbij de overheid weerstand tegen spionage en misbruik moet organiseren. Ongeautoriseerde openbaarmaking is schadelijk en moet zoveel mogelijk worden voorkomen. De gevolgen kunnen aanzienlijk zijn: reputatieschade, juridische claims en verstoring van de samenwerking met partners. Bij dit niveau wordt minimaal BIO2 toegepast, aangevuld met risicomanagement en waar nodig extra maatregelen.' },
      { label: ANSWER_LABELS[3], info: 'Intern: Dit betreft informatie die binnen de organisatie moet blijven, maar waarvan de gevolgen van openbaarmaking nog beperkt zijn. Onbevoegde kennisname is ongewenst, omdat dit hinder kan veroorzaken of herstelwerk nodig maakt. Er kan sprake zijn van lichte reputatieschade of interne verstoring, maar de gevolgen zijn doorgaans herstelbaar.' },
      { label: ANSWER_LABELS[4], info: 'Openbaar: Het gaat hier om informatie die zonder risico gedeeld kan worden met iedereen. De gegevens zijn bedoeld voor openbaarheid, bijvoorbeeld op de gemeentelijke website of in een folder. Ongeautoriseerde kennisname levert geen schade op. Let op: deze gegevens kunnen nog steeds integer, authentiek en beschikbaar moeten zijn.' },
    ],
  },
]

// ── BCP helper ────────────────────────────────────────────────────────────────

// Returns the answer info text for the selected score on a given question
function bcpAnswerInfo(question: BiaQuestion, score: number | undefined): string | undefined {
  if (score == null || score < 1 || score > 5) return undefined
  return question.answers[score - 1]?.info
}

// ── Score label map ───────────────────────────────────────────────────────────

const SCORE_LABELS: Record<number, string> = {
  1: 'Catastrofaal',
  2: 'Kritiek / zeer ernstig',
  3: 'Gemiddeld',
  4: 'Gering',
  5: 'Verwaarloosbaar',
}

// ── BCP compact value mapping (source: Word doc, score 1–5 → compact label) ──

const BCP_COMPACT_MAP = {
  mtpd: { 1: 'enkele uren niet acceptabel', 2: 'maximaal 8 uur', 3: 'maximaal 2 werkdagen', 4: 'maximaal 1 week',   5: 'langer dan een week' },
  rto:  { 1: 'binnen enkele uren',          2: 'binnen 8 uur',   3: 'binnen 2 werkdagen',   4: 'binnen een week',   5: 'langer dan een week' },
  wrt:  { 1: 'meerdere werkdagen',           2: '1 werkdag',      3: '4–8 uur',              4: '1–4 uur',           5: 'minder dan 1 uur'    },
  rpo:  { 1: 'enkele uren',                  2: '4–8 uur',        3: '8–24 uur',             4: 'maximaal 24 uur',   5: 'een week of meer'    },
} as const

type TabKey = 'Algemeen' | 'Beschikbaarheid' | 'Integriteit' | 'Vertrouwelijkheid'

// Highest severity = lowest numeric value (1=Catastrofaal, 5=Verwaarloosbaar)
function highestSeverity(scores: (number | undefined)[]): number | undefined {
  const valid = scores.filter((s): s is number => s !== undefined && s !== null && s > 0)
  return valid.length ? Math.min(...valid) : undefined
}

// ── Info popover (reused from BusinessContext pattern) ───────────────────────

function InfoPopover({ text, onClose }: { text: string; onClose: () => void }) {
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
      className="absolute top-7 right-0 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
    >
      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BiaPage() {
  const { processId } = useParams<{ processId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('Algemeen')
  const [scope, setScope] = useState<'IT-Continuïteit' | 'Business Continuïteit'>('IT-Continuïteit')
  const [selectedPid, setSelectedPid] = useState<number | undefined>(
    processId ? Number(processId) : undefined,
  )

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: () => processesApi.list(),
  })

  const pid = selectedPid
  const { data: bia } = useQuery({
    queryKey: ['bia', pid],
    queryFn: () => biaApi.get(pid!),
    enabled: !!pid,
    retry: false,
  })

  const [form, setForm] = useState<Partial<BiaAssessment>>({})
  const currentForm: Partial<BiaAssessment> = bia ? { ...bia, ...form } : form
  const setField = (k: keyof BiaAssessment, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // Auto-calculate final scores: highest severity (= lowest numeric) across all answered questions
  const autoB = useMemo(
    () => highestSeverity([currentForm.b1_score, currentForm.b2_score] as (number | undefined)[]),
    [currentForm.b1_score, currentForm.b2_score],
  )
  const autoI = useMemo(
    () => highestSeverity([currentForm.i1_score] as (number | undefined)[]),
    [currentForm.i1_score],
  )
  const autoV = useMemo(
    () => highestSeverity([currentForm.v1_score] as (number | undefined)[]),
    [currentForm.v1_score],
  )

  // Effective form: auto-calculated scores override stored values
  const effectiveForm: Partial<BiaAssessment> = {
    ...currentForm,
    ...(autoB !== undefined && { availability_score: autoB }),
    ...(autoI !== undefined && { integrity_score: autoI }),
    ...(autoV !== undefined && { confidentiality_score: autoV }),
  }

  const mutation = useMutation({
    mutationFn: () => biaApi.upsert(pid!, effectiveForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bia', pid] })
      qc.invalidateQueries({ queryKey: ['processes'] })
      setForm({})
    },
  })

  // Autosave: debounce 600ms after any form change
  useEffect(() => {
    if (!pid || Object.keys(form).length === 0) return
    const t = setTimeout(() => mutation.mutate(), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pid])

  return (
    <div className="flex gap-6">
      {/* Process selector sidebar */}
      <aside className="w-56 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processen</div>
          <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
            {processes.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => { setSelectedPid(p.id); setForm({}); navigate(`/bia/${p.id}`) }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    pid === p.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-1">
                    <span>{p.code}</span>
                    {p.has_bia && <span className="text-green-500">✓</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <PageHeader
          title="BIA & BIV-Classificatie"
          subtitle={pid ? processes.find(p => p.id === pid)?.name : 'Selecteer een proces'}
        />

        {!pid && (
          <Card className="text-center py-12 text-gray-400">
            <p>Selecteer een proces aan de linkerkant om de BIA in te vullen.</p>
          </Card>
        )}

        {/* Scope Selector */}
        <div className="flex items-center gap-3 mb-5">
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

        {pid && (
          <>
            {/* Score summary */}
            {(() => {
              const procScore = highestSeverity([autoB, autoI, autoV])
              const subScores = [
                { abbr: 'B', label: 'Beschikbaarheid', score: effectiveForm.availability_score },
                { abbr: 'I', label: 'Integriteit',     score: effectiveForm.integrity_score },
                { abbr: 'V', label: 'Vertrouwelijkheid', score: effectiveForm.confidentiality_score },
              ]
              return (
                <div className="mb-4">
                  {/* Parent: Procesclassificatie */}
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

                  {/* Children: B / I / V */}
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
            })()}

            <div className="flex gap-2 mb-4 border-b border-gray-200">
              {(['Algemeen', 'Beschikbaarheid', 'Integriteit', 'Vertrouwelijkheid'] as TabKey[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'Algemeen' && (
              <>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label="Interviewer">
                    <Input value={currentForm.interviewer_name ?? ''} onChange={e => setField('interviewer_name', e.target.value)} />
                  </FormField>
                  <FormField label="Laatste review datum">
                    {(() => {
                      const cutoff = new Date()
                      cutoff.setFullYear(cutoff.getFullYear() - 1)
                      const reviewDate = currentForm.interview_date ? new Date(currentForm.interview_date) : null
                      const isExpired = reviewDate !== null && reviewDate < cutoff
                      return (
                        <>
                          <input
                            type="date"
                            value={currentForm.interview_date ?? ''}
                            onChange={e => setField('interview_date', e.target.value)}
                            className={[
                              'w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent',
                              isExpired
                                ? 'border border-red-300 bg-red-50 text-red-700 focus:ring-red-300'
                                : 'border border-gray-300 focus:ring-brand-500',
                            ].join(' ')}
                          />
                          {isExpired && (
                            <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 self-start">
                              Review verlopen
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </FormField>

                  <FormField label="Notities" className="md:col-span-2">
                    <Textarea value={currentForm.notes ?? ''} onChange={e => setField('notes', e.target.value)} rows={2} />
                  </FormField>
                </div>
              </Card>

              <Card className="mt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Continuïteitsparameters</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label={scope === 'Business Continuïteit' ? 'MTPD / MTD – Max. uitvalduur' : 'RTO – Max. uitvalduur'}>
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[0], effectiveForm.b1_score)} />
                  </FormField>
                  <FormField label="RPO – Max. dataverlies">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[1], effectiveForm.b2_score)} />
                  </FormField>
                </div>
                <div className="mt-8 pt-8 border-t border-gray-100">
                  {scope === 'IT-Continuïteit' ? (
                    <ItContinueitTimeline
                      rto={effectiveForm.b1_score ? BCP_COMPACT_MAP.mtpd[effectiveForm.b1_score as keyof typeof BCP_COMPACT_MAP.mtpd] : undefined}
                      rpo={effectiveForm.b2_score ? BCP_COMPACT_MAP.rpo[effectiveForm.b2_score as keyof typeof BCP_COMPACT_MAP.rpo] : undefined}
                    />
                  ) : (
                    <img
                      src={businessContinueiteitImg}
                      alt="Business Continuïteit tijdlijn"
                      className="w-full h-auto block"
                      draggable={false}
                    />
                  )}
                </div>
              </Card>
              </>
            )}

            {tab === 'Beschikbaarheid' && (
              <Card>
                <p className="text-sm text-gray-500 mb-5">Beoordeel de impact van uitval van het proces op onderstaande criteria.</p>
                <div className="space-y-6">
                  {B_QUESTIONS.map(q => (
                    <QuestionBlock
                      key={q.key}
                      question={q}
                      score={effectiveForm[`${q.key}_score` as keyof BiaAssessment] as number}
                      arg={effectiveForm[`${q.key}_arg` as keyof BiaAssessment] as string}
                      onScore={v => setField(`${q.key}_score` as keyof BiaAssessment, v)}
                      onArg={v => setField(`${q.key}_arg` as keyof BiaAssessment, v)}
                    />
                  ))}
                </div>
              </Card>
            )}

            {tab === 'Integriteit' && (
              <Card>
                <p className="text-sm text-gray-500 mb-5">Beoordeel de impact van onjuiste of gemanipuleerde gegevens op onderstaande criteria.</p>
                <div className="space-y-6">
                  {I_QUESTIONS.map(q => (
                    <QuestionBlock
                      key={q.key}
                      question={q}
                      score={effectiveForm[`${q.key}_score` as keyof BiaAssessment] as number}
                      arg={effectiveForm[`${q.key}_arg` as keyof BiaAssessment] as string}
                      onScore={v => setField(`${q.key}_score` as keyof BiaAssessment, v)}
                      onArg={v => setField(`${q.key}_arg` as keyof BiaAssessment, v)}
                    />
                  ))}
                </div>
              </Card>
            )}

            {tab === 'Vertrouwelijkheid' && (
              <Card>
                <p className="text-sm text-gray-500 mb-5">Beoordeel de impact van datalekkage of ongeautoriseerde toegang op onderstaande criteria.</p>
                <div className="space-y-6">
                  {V_QUESTIONS.map(q => (
                    <QuestionBlock
                      key={q.key}
                      question={q}
                      score={effectiveForm[`${q.key}_score` as keyof BiaAssessment] as number}
                      arg={effectiveForm[`${q.key}_arg` as keyof BiaAssessment] as string}
                      onScore={v => setField(`${q.key}_score` as keyof BiaAssessment, v)}
                      onArg={v => setField(`${q.key}_arg` as keyof BiaAssessment, v)}
                    />
                  ))}
                </div>
              </Card>
            )}

          </>
        )}
      </div>
    </div>
  )
}

// ── BcpValueDisplay ───────────────────────────────────────────────────────────

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

// ── AutoScoreDisplay ──────────────────────────────────────────────────────────

// Score color classes matching severity (1=most severe, 5=least severe)
const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-50 border-red-300 text-red-700',
  2: 'bg-orange-50 border-orange-300 text-orange-700',
  3: 'bg-yellow-50 border-yellow-300 text-yellow-700',
  4: 'bg-blue-50 border-blue-300 text-blue-700',
  5: 'bg-green-50 border-green-300 text-green-700',
}

// Solid background + text for the Procesclassificatie strip
const SCORE_STRIP_BG: Record<number, string> = {
  1: 'bg-red-50',
  2: 'bg-orange-50',
  3: 'bg-yellow-50',
  4: 'bg-blue-50',
  5: 'bg-green-50',
}
const SCORE_STRIP_TEXT: Record<number, string> = {
  1: 'text-red-700',
  2: 'text-orange-700',
  3: 'text-yellow-700',
  4: 'text-blue-700',
  5: 'text-green-700',
}
const SCORE_CIRCLE: Record<number, string> = {
  1: 'bg-red-100 text-red-700 ring-red-200',
  2: 'bg-orange-100 text-orange-700 ring-orange-200',
  3: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  4: 'bg-blue-100 text-blue-700 ring-blue-200',
  5: 'bg-green-100 text-green-700 ring-green-200',
}

function AutoScoreDisplay({ score, fallback }: { score: number | undefined; fallback: string }) {
  if (score === undefined) {
    return (
      <div className="flex items-center h-9 px-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
        {fallback}
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium ${SCORE_COLORS[score] ?? 'bg-gray-50 border-gray-300 text-gray-700'}`}>
      <span>{SCORE_LABELS[score]}</span>
      <span className="ml-auto text-xs font-normal opacity-60">automatisch</span>
    </div>
  )
}

// ── BcpTimeline ───────────────────────────────────────────────────────────────
// Uses Visual BC-Parameters.png (1872×576) as a fixed background template.
// Only the 4 dynamic values (mtpd, rto, wrt, rpo) are overlaid via absolute positioning.
//
// Calibration against Visual BC-Parameters.png (1872×576 px) — pixel-scanned:
//   Arrows at y=210 (36.5%) define RPO/RTO/WRT horizontal spans:
//     RPO:  x=374–705,  center=540  → left=28.8%
//     RTO:  x=728–1145, center=936  → left=50.0%
//     WRT:  x=1167–1522,center=1344 → left=71.8%
//   MTD bracket lines at y=66 and y=107:
//     Horizontal span: x=978–1251, center=1114 → left=59.5%
//   Value text Y zones (% of height):
//     MTD value:        14.9% (y≈86, center of white zone y=67–105 inside bracket)
//     RPO/RTO/WRT:      42.5% (y≈245, center of white zone y=226–264 below arrows)

function BcpTimeline({ mtpd, rto, wrt, rpo }: {
  mtpd?: string; rto?: string; wrt?: string; rpo?: string
}) {
  const dash = '—'
  const cap = (s?: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : dash

  // Base overlay style: no background, no border — text appears to be part of the image.
  // left/top mark the CENTER of the text element (via translate -50% -50%).
  // Positions calibrated from pixel scan of Visual BC-Parameters.png (1872×576):
  //   Each label is centered in its largest unobstructed white run within the image.
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
      {/* ── Static template image ── */}
      <img
        src={bcpTimelineImg}
        alt="Business Continuity tijdlijn: Business As Usual → Dataverlies → Systeemuitval → Hervatting Productie → Business As Usual"
        className="w-full h-auto block"
        draggable={false}
      />

      {/* MTD/MTPD — bracket x=978–1251 (center=1114 → 59.5%), white zone y=67–105 (center=86 → 14.9%) */}
      <span style={{ ...base, left: '59.5%', top: '14.9%' }}>
        {cap(mtpd)}
      </span>

      {/* RPO — arrow x=374–705 (center=540 → 28.8%), white zone y=226–264 (center=245 → 42.5%) */}
      <span style={{ ...base, left: '28.8%', top: '42.5%' }}>
        {cap(rpo)}
      </span>

      {/* RTO — arrow x=728–1145 (center=936 → 50.0%), white zone y=226–264 (center=245 → 42.5%) */}
      <span style={{ ...base, left: '50.0%', top: '42.5%' }}>
        {cap(rto)}
      </span>

      {/* WRT — arrow x=1167–1522 (center=1344 → 71.8%), white zone y=226–264 (center=245 → 42.5%) */}
      <span style={{ ...base, left: '71.8%', top: '42.5%' }}>
        {cap(wrt)}
      </span>
    </div>
  )
}

// ── ItContinueitTimeline ──────────────────────────────────────────────────────
// Uses IT-Continuiteit.png (1872×576) as background; overlays RPO and RTO.
// Calibration via pixel scan — white box centers:
//   RPO: x=540 → left=28.8%, y≈202 → top=35.1%
//   RTO: x=937 → left=50.1%, y≈202 → top=35.1%

function ItContinueitTimeline({ rto, rpo }: { rto?: string; rpo?: string }) {
  const dash = '—'
  const cap = (s?: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : dash

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
        src={itContinueiteitImg}
        alt="IT-Continuïteit tijdlijn: RPO en RTO"
        className="w-full h-auto block"
        draggable={false}
      />
      {/* RPO — x=540 (28.8%), white zone center y≈202 (35.1%) */}
      <span style={{ ...base, left: '28.8%', top: '35.1%' }}>
        {cap(rpo)}
      </span>
      {/* RTO — x=937 (50.1%), white zone center y≈202 (35.1%) */}
      <span style={{ ...base, left: '50.1%', top: '35.1%' }}>
        {cap(rto)}
      </span>
    </div>
  )
}

// ── QuestionBlock ─────────────────────────────────────────────────────────────

function QuestionBlock({ question, score, arg, onScore, onArg }: {
  question: BiaQuestion
  score?: number
  arg?: string
  onScore: (v: number | undefined) => void
  onArg: (v: string) => void
}) {
  const [openQuestionInfo, setOpenQuestionInfo] = useState(false)
  const [openAnswerInfo, setOpenAnswerInfo] = useState<number | null>(null)

  return (
    <div className="border-b border-gray-100 pb-5 last:border-0">
      {/* Question label + optional i-icon */}
      <div className="flex items-start gap-1.5 mb-3">
        <div className="font-medium text-sm text-gray-800 flex-1">{question.label}</div>
        {question.tooltip && (
          <div className="relative shrink-0 mt-0.5">
            <button
              onClick={e => { e.stopPropagation(); setOpenQuestionInfo(v => !v) }}
              className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              title="Meer informatie"
            >
              <Info size={14} strokeWidth={1.75} />
            </button>
            {openQuestionInfo && (
              <InfoPopover text={question.tooltip} onClose={() => setOpenQuestionInfo(false)} />
            )}
          </div>
        )}
      </div>

      {/* Answer buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {question.answers.map((opt, idx) => {
          const val = idx + 1
          return (
            <div key={val} className="relative">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onScore(score === val ? undefined : val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    score === val
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                  }`}
                >
                  {opt.label}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setOpenAnswerInfo(prev => prev === val ? null : val) }}
                  className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                  title="Toelichting antwoord"
                >
                  <Info size={12} strokeWidth={1.75} />
                </button>
              </div>
              {openAnswerInfo === val && (
                <InfoPopover text={opt.info} onClose={() => setOpenAnswerInfo(null)} />
              )}
            </div>
          )
        })}
      </div>

      {/* Argumentation textarea */}
      <textarea
        rows={2}
        placeholder="Toelichting / argumentatie..."
        value={arg ?? ''}
        onChange={e => onArg(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
      />
    </div>
  )
}
