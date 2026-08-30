import itContinueiteitImg from '../../assets/it-continuiteit.png'
import businessContinueiteitImg from '../../assets/business-continuiteit.png'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, ChevronDown } from 'lucide-react'
import { processesApi } from '../../api/processes'
import { biaApi } from '../../api/bia'
import { apiErrorMessage } from '../../api/client'
import { isReviewExpired } from '../../utils/review'
import { useMe } from '../../hooks/useMe'
import { PARAM_MAP, paramLabel } from './biaShared'
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
    tooltip: 'Elementen van de vraag:\n\n• Dit proces valt morgenochtend volledig uit. Wanneer begint dat écht een probleem te worden, niet alleen vervelend, maar met gevolgen voor klanten, burgers en/of de gemeente?\n\n• Op welk moment ga jij naar je leidinggevende en zeg je: dit moet geëscaleerd worden, als normaal incident behandelen is niet voldoende?\n\n• Zijn er wettelijke termijnen of contractuele afspraken die bepalen hoe lang het proces maximaal mag stilliggen?\n\n• Hoe lang kan de uitval worden opgevangen zonder dat de schade onaanvaardbaar wordt? Op welk moment moet het proces écht weer operationeel zijn?',
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
    tooltip: 'Elementen van de vraag:\n\n• Als we het systeem herstellen, maar de gegevens van de afgelopen uren zijn weg, is dat acceptabel?\n\n• Hoe snel veranderen gegevens, zijn dit doorlopende wijzigingen?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Uitval van enkele uren is niet acceptabel en kan leiden tot onherstelbare schade en bestuurlijke crisis. De informatie is onvervangbaar en de processen die ermee samenhangen zijn vitaal voor de samenleving. Continuïteit moet permanent worden gewaarborgd. Near real-time beschikbaarheid is noodzakelijk. Uitval raakt direct de kern van de organisatie en kan het vertrouwen van burgers en bestuur onherstelbaar aantasten.' },
      { label: ANSWER_LABELS[1], info: 'Een dataverlies van 4 tot 8 uur of een systeemuitval van maximaal 8 uur kan strategische processen stilleggen. De informatie is moeilijk te vervangen en herstel vergt veel tijd, middelen en geld. De gevolgen worden breed gevoeld, zowel in de organisatie als daarbuiten, en kunnen leiden tot forse maatschappelijke ontwrichting en bestuurlijke druk.' },
      { label: ANSWER_LABELS[2], info: 'Een dataverlies van 8 tot 24 uur of een systeemuitval van maximaal 2 werkdagen heeft aanzienlijke invloed op kernactiviteiten en kan leiden tot klachten of verminderde dienstverlening. Het herstel van de informatie of systemen vergt aanzienlijke inspanning en brengt extra kosten met zich mee. De maatschappelijke impact wordt zichtbaar, maar met voldoende inzet in herstel nog goed mogelijk.' },
      { label: ANSWER_LABELS[3], info: 'Een dataverlies van maximaal 24 uur of een systeemuitval van maximaal 1 week kan leiden tot hinder in processen, maar de dienstverlening blijft grotendeels doorgaan. Herstel vraagt wel enige inspanning en planning, maar is goed uitvoerbaar. Voor burgers is er beperkte merkbare overlast en het vertrouwen in de organisatie blijft in stand.' },
      { label: ANSWER_LABELS[4], info: 'Een dataverlies van een week of meer of een systeemuitval die oploopt tot meer dan een week kan zonder merkbare schade worden opgevangen. Kernactiviteiten blijven doorgaan, hooguit met lichte vertraging, en de informatie kan eenvoudig worden vervangen of hersteld. Voor burgers of bestuurders is er geen voelbare impact en de continuïteit van de organisatie komt niet in gevaar.' },
    ],
  },
  {
    key: 'b3',
    label: 'Hoeveel tijd is er nodig om, nadat de systemen weer beschikbaar zijn, alle achterstallige werkzaamheden en administratie in te halen tot het proces weer op een normaal operationeel niveau draait?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Enkele uren' },
      { label: ANSWER_LABELS[1], info: '4 tot 8 uur' },
      { label: ANSWER_LABELS[2], info: '2 werkdagen' },
      { label: ANSWER_LABELS[3], info: '1 week' },
      { label: ANSWER_LABELS[4], info: 'Meer dan een week' },
    ],
  },
  {
    key: 'b4',
    label: 'Wat is de maximale tijdsduur dat dit proces stil kan liggen (houd hierbij rekening met uitval van systemen, herstelwerkzaamheden en het volledig wegwerken van eventuele achterstanden)?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Enkele uren' },
      { label: ANSWER_LABELS[1], info: '4 tot 8 uur' },
      { label: ANSWER_LABELS[2], info: '2 werkdagen' },
      { label: ANSWER_LABELS[3], info: '1 week' },
      { label: ANSWER_LABELS[4], info: 'Meer dan een week' },
    ],
  },
]

// ── Integriteit questions (Template BIA & BIV-Classificatie.xlsx) ─────────────

const I_QUESTIONS: BiaQuestion[] = [
  {
    key: 'i1',
    label: 'Wat is de impact wanneer informatie onjuist, onvolledig of gemanipuleerd is?',
    tooltip: 'Elementen van de vraag:\n\n• Wat zijn de gevolgen als achteraf blijkt dat de gebruikte informatie niet klopte? Welke werkzaamheden of beslissingen werden hierop gebaseerd?\n\n• Hoeveel afwijking in gegevens is nog acceptabel?\n\n• Als gegevens fout blijken te zijn, hoe makkelijk is het te herstellen in tijd, moeite en impact?\n\n• Wat zou er gebeuren als iemand gegevens doelbewust aanpast? Hoe snel wordt gemerkt dat de informatie niet meer klopt?',
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
    tooltip: 'Elementen van de vraag:\n\n• Welke informatie mag absoluut niet worden ingezien door onbevoegden? Waar ligt de grens voor wat écht ernstig is?\n\n• Informatie komt morgen in handen van iemand die het niet mag zien, wat zijn de gevolgen?\n\n• Wat zijn de gevolgen als informatie publiekelijk wordt gelekt? Maakt het uit hoeveel er uitlekt, één dossier versus alles?\n\n• Als de informatie eenmaal op straat ligt, is de schade dan nog te herstellen? Wat kan iemand ermee doen als diegene het in handen krijgt?',
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

// Parameter-labels per score komen uit PARAM_MAP in biaShared:
// b1 (max. uitvalduur) → RTO, b2 (max. dataverlies) → RPO,
// b3 (herstelwerk) → WRT, b4 (totale uitval) → MTPD/MTD

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
  const { canEdit } = useMe()

  // pid volgt de URL, zodat ook browser-terug/vooruit het juiste proces toont
  const pid = processId ? Number(processId) : undefined

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: () => processesApi.list(),
  })

  const { data: bia } = useQuery({
    queryKey: ['bia', pid],
    queryFn: () => biaApi.get(pid!),
    enabled: !!pid,
    retry: false,
  })

  const [form, setForm] = useState<Partial<BiaAssessment>>({})
  const currentForm: Partial<BiaAssessment> = bia ? { ...bia, ...form } : form
  const setField = (k: keyof BiaAssessment, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // Bij proceswissel hoort het formulier leeg te beginnen
  useEffect(() => { setForm({}) }, [pid])

  // Auto-calculate final scores: highest severity (= lowest numeric) across all answered questions
  const autoB = useMemo(
    () => highestSeverity([currentForm.b1_score, currentForm.b2_score, currentForm.b3_score, currentForm.b4_score] as (number | undefined)[]),
    [currentForm.b1_score, currentForm.b2_score, currentForm.b3_score, currentForm.b4_score],
  )
  const autoI = useMemo(
    () => highestSeverity([currentForm.i1_score] as (number | undefined)[]),
    [currentForm.i1_score],
  )
  const autoV = useMemo(
    () => highestSeverity([currentForm.v1_score] as (number | undefined)[]),
    [currentForm.v1_score],
  )

  // Effective form: de B/I/V-scores worden altijd afgeleid uit de vragen.
  // Null (niet undefined) als er geen vraag beantwoord is, zodat de waarde
  // ook echt naar de backend wordt gestuurd en daar gewist wordt — anders
  // blijft een oude classificatie hangen nadat alle antwoorden zijn gewist.
  const effectiveForm: Partial<BiaAssessment> = {
    ...currentForm,
    availability_score: autoB ?? null,
    integrity_score: autoI ?? null,
    confidentiality_score: autoV ?? null,
  }

  // Conflictdetectie: iemand anders sloeg dezelfde BIA op terwijl wij bewerkten
  const [conflict, setConflict] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ pid: targetPid, data }: { pid: number; data: Partial<BiaAssessment> }) =>
      biaApi.upsert(targetPid, { ...data, expected_updated_at: bia?.updated_at }),
    onSuccess: (_result, { pid: savedPid, data }) => {
      setConflict(false)
      qc.invalidateQueries({ queryKey: ['bia', savedPid] })
      qc.invalidateQueries({ queryKey: ['processes'] })
      // Wis alleen velden die ongewijzigd zijn opgeslagen; toetsaanslagen die
      // tijdens de save binnenkwamen blijven zo behouden.
      setForm(f => {
        const next: Partial<BiaAssessment> = { ...f }
        for (const key of Object.keys(f) as (keyof BiaAssessment)[]) {
          if (next[key] === data[key]) delete next[key]
        }
        return next
      })
    },
    onError: (err) => {
      // 409 = optimistic-locking-conflict: verse data ophalen; de autosave
      // hieronder probeert het daarna opnieuw bovenop de nieuwste versie.
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setConflict(true)
        qc.invalidateQueries({ queryKey: ['bia', pid] })
      }
    },
  })

  // Autosave: debounce 600ms na elke formulierwijziging. bia?.updated_at zit
  // in de deps zodat na een conflict-refetch de merge opnieuw wordt opgeslagen.
  useEffect(() => {
    if (!pid || !canEdit || Object.keys(form).length === 0) return
    const t = setTimeout(() => mutation.mutate({ pid, data: effectiveForm }), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pid, bia?.updated_at, canEdit])

  // Proceswissel via de zijbalk: eventuele nog niet opgeslagen wijzigingen
  // eerst wegschrijven (naar het oude proces), dan navigeren.
  const goToProcess = (targetId: number) => {
    if (targetId === pid) return
    if (pid && canEdit && Object.keys(form).length > 0) {
      mutation.mutate({ pid, data: effectiveForm })
    }
    navigate(`/bia/${targetId}`)
  }

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
                  onClick={() => goToProcess(p.id)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    pid === p.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-ink-subtle mt-0.5 flex gap-1">
                    <span>{p.code}</span>
                    {p.has_bia && <span className="text-green-700">✓</span>}
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
          <Card className="text-center py-12 text-ink-subtle">
            <p>Selecteer een proces aan de linkerkant om de BIA in te vullen.</p>
          </Card>
        )}

        {pid && (
          <>
          {/* Scope Selector + autosave status */}
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
            <span className="ml-auto text-xs">
              {!canEdit && (
                <span className="text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                  Alleen-lezen — je hebt de rol lezer, wijzigingen worden niet opgeslagen
                </span>
              )}
              {mutation.isPending && <span className="text-ink-subtle">Opslaan…</span>}
              {conflict && !mutation.isPending && (
                <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  Iemand anders heeft deze BIA gewijzigd — gegevens ververst, jouw wijzigingen worden opnieuw toegepast
                </span>
              )}
              {mutation.isError && !conflict && (
                <span className="text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  Opslaan mislukt: {apiErrorMessage(mutation.error)}
                </span>
              )}
            </span>
          </div>
          </>
        )}

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
                      const isExpired = isReviewExpired(currentForm.interview_date)
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
                  {/* b1 (max. uitvalduur) → RTO, b2 (max. dataverlies) → RPO */}
                  <FormField label="RTO – Max. uitvalduur">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[0], effectiveForm.b1_score)} />
                  </FormField>
                  <FormField label="RPO – Max. dataverlies">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[1], effectiveForm.b2_score)} />
                  </FormField>
                  {scope === 'Business Continuïteit' && (
                    <>
                      <FormField label="WRT – Herstelwerkzaamheden">
                        <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[2], effectiveForm.b3_score)} />
                      </FormField>
                      <FormField label="MTPD / MTD – Totale uitvalduur">
                        <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[3], effectiveForm.b4_score)} />
                      </FormField>
                    </>
                  )}
                </div>
                <div className="mt-8 pt-8 border-t border-gray-100">
                  {scope === 'IT-Continuïteit' ? (
                    <ItContinueitTimeline
                      rto={paramLabel(PARAM_MAP.rto, effectiveForm.b1_score)}
                      rpo={paramLabel(PARAM_MAP.rpo, effectiveForm.b2_score)}
                    />
                  ) : (
                    <BcContinueitTimeline
                      rto={paramLabel(PARAM_MAP.rto, effectiveForm.b1_score)}
                      rpo={paramLabel(PARAM_MAP.rpo, effectiveForm.b2_score)}
                      wrt={paramLabel(PARAM_MAP.wrt, effectiveForm.b3_score)}
                      mtd={paramLabel(PARAM_MAP.mtd, effectiveForm.b4_score)}
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
                  {B_QUESTIONS.filter(q => scope === 'Business Continuïteit' || !['b3', 'b4'].includes(q.key)).map(q => (
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
// ── ItContinueitTimeline ──────────────────────────────────────────────────────
// Uses IT-Continuiteit.png (1872×576) as background; overlays RPO and RTO.
// Calibration via pixel scan — white box centers:
//   RPO: x=540 → left=28.8%, y=245 → top=42.5%
//   RTO: x=937 → left=50.1%, y=245 → top=42.5%

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
      {/* RPO — x=540 (28.8%), white box center y=245 (42.5%) */}
      <span style={{ ...base, left: '28.8%', top: '42.5%' }}>
        {cap(rpo)}
      </span>
      {/* RTO — x=937 (50.1%), white box center y=245 (42.5%) */}
      <span style={{ ...base, left: '50.1%', top: '42.5%' }}>
        {cap(rto)}
      </span>
    </div>
  )
}

// ── BcContinueitTimeline ──────────────────────────────────────────────────────
// Uses Business Continuiteit.png (1872×576) as background; overlays RPO, RTO, WRT, MTD.
// Calibration via pixel scan — white box centers:
//   RPO: x=540 → left=28.8%, y=245 → top=42.5%
//   RTO: x=937 → left=50.1%, y=245 → top=42.5%
//   WRT: x=1344 → left=71.8%, y=245 → top=42.5%
//   MTD: x=1114 → left=59.5%, y=86  → top=14.9%

function BcContinueitTimeline({ rpo, rto, wrt, mtd }: { rpo?: string; rto?: string; wrt?: string; mtd?: string }) {
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
        src={businessContinueiteitImg}
        alt="Business Continuïteit tijdlijn"
        className="w-full h-auto block"
        draggable={false}
      />
      {/* MTD — bracket center x=59.5%, white box center y=86 (14.9%) */}
      <span style={{ ...base, left: '59.5%', top: '14.9%' }}>{cap(mtd)}</span>
      {/* RPO — x=28.8%, white box center y=245 (42.5%) */}
      <span style={{ ...base, left: '28.8%', top: '42.5%' }}>{cap(rpo)}</span>
      {/* RTO — x=50.1%, white box center y=245 (42.5%) */}
      <span style={{ ...base, left: '50.1%', top: '42.5%' }}>{cap(rto)}</span>
      {/* WRT — x=71.8%, white box center y=245 (42.5%) */}
      <span style={{ ...base, left: '71.8%', top: '42.5%' }}>{cap(wrt)}</span>
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
              className="p-0.5 rounded text-ink-subtle hover:text-ink-muted hover:bg-gray-100 transition-colors"
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
                  className="p-0.5 rounded text-ink-subtle hover:text-ink-muted hover:bg-gray-100 transition-colors"
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
