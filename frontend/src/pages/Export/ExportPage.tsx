import { useState } from 'react'
import {
  LayoutDashboard, GitBranch, Monitor, Shield, Map, Network,
  FileText, FileSpreadsheet, Presentation, Download, CheckSquare,
  Square, ChevronRight,
} from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'

// ── Types ─────────────────────────────────────────────────────────────────────

type Format = 'xlsx' | 'docx' | 'pptx'

interface Section {
  id: string
  label: string
  description: string
}

interface Module {
  id: string
  label: string
  icon: React.ReactNode
  sections: Section[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1/export`

const MODULES: Module[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={16} />,
    sections: [
      { id: 'kpi',               label: 'KPI Overzicht',      description: 'Dekkingspercentages, aantallen compleet / aandacht / incompleet' },
      { id: 'biv_verdeling',     label: 'BIV-verdeling',      description: 'Distributie van BIV-scores per dimensie (B / I / V)' },
      { id: 'kritieke_processen',label: 'Kritieke Processen',  description: 'Lijst van kritieke processen met hun BIV-scores' },
      { id: 'review',            label: 'Review Monitoring',   description: 'Op-tijd-status van beoordelingen voor processen, applicaties en BIA' },
      { id: 'acties',            label: 'Prioritaire Acties',  description: 'Openstaande actiepunten gesorteerd op prioriteit' },
    ],
  },
  {
    id: 'processes',
    label: 'Processen',
    icon: <GitBranch size={16} />,
    sections: [
      { id: 'basis',      label: 'Basisgegevens',        description: 'Code, naam, eigenaar, afdeling, kritiekstatus' },
      { id: 'details',    label: 'Details',              description: 'Beschrijving, doelstelling en notities' },
      { id: 'biv',        label: 'BIV-scores',           description: 'Beschikbaarheid-, integriteit- en vertrouwelijkheidsscore' },
      { id: 'rto_rpo',    label: 'RTO / RPO',            description: 'Recovery Time Objective en Recovery Point Objective waarden' },
      { id: 'applicaties',label: 'Gekoppelde Applicaties',description: 'Overzicht van applicaties gekoppeld aan elk proces' },
      { id: 'datums',     label: 'Datums',               description: 'Beoordelings- en aanmaakdatum per proces' },
    ],
  },
  {
    id: 'applications',
    label: 'Applicaties',
    icon: <Monitor size={16} />,
    sections: [
      { id: 'basis',    label: 'Basisgegevens',        description: 'Code, naam, business owner en technisch owner' },
      { id: 'details',  label: 'Details',              description: 'Beschrijving en notities' },
      { id: 'review',   label: 'Review Datum',         description: 'Geplande review datum per applicatie' },
      { id: 'processen',label: 'Gekoppelde Processen', description: 'Processen waaraan de applicatie is gekoppeld' },
    ],
  },
  {
    id: 'bia',
    label: 'BIA & BIV-Classificatie',
    icon: <Shield size={16} />,
    sections: [
      { id: 'algemeen',         label: 'Algemene Informatie',    description: 'Interviewer, datum, beschrijving en ketenafhankelijkheden' },
      { id: 'beschikbaarheid',  label: 'Beschikbaarheid B1–B4',  description: 'Antwoorden op de vier beschikbaarheidsvragen (uitval, dataverlies, herstel, MTPD)' },
      { id: 'integriteit',      label: 'Integriteit I1',         description: 'Impact van onjuiste of gemanipuleerde informatie' },
      { id: 'vertrouwelijkheid',label: 'Vertrouwelijkheid V1',   description: 'Impact bij ongeautoriseerde inzage of verspreiding' },
      { id: 'eindscores',       label: 'Eindscores BIV',         description: 'Definitieve B-, I- en V-classificaties per proces' },
    ],
  },
  {
    id: 'business-context',
    label: 'Procescontext',
    icon: <Map size={16} />,
    sections: [
      { id: 'canvas',      label: 'Canvas Blokken',       description: 'Kern partners, activiteiten, propositie, klantrelaties, segmenten, kanalen, resources, kosten en inkomsten' },
      { id: 'wettelijk',   label: 'Wettelijk & Stakeholders', description: 'Wettelijke basis, stakeholders, ketenpositie en key aspects' },
      { id: 'privacy',     label: 'Privacy',              description: 'Aanwezigheid van persoonsgegevens en bijzondere persoonsgegevens' },
      { id: 'continuiteit',label: 'Continuïteit',         description: 'Continuïteitsvereisten, review datum en notities' },
    ],
  },
  {
    id: 'ketenarchitectuur',
    label: 'Ketenarchitectuur',
    icon: <Network size={16} />,
    sections: [
      { id: 'processen',  label: 'Processen',   description: 'Alle processen met eigenaar, afdeling, kritiekstatus en BIV-scores' },
      { id: 'applicaties',label: 'Applicaties', description: 'Alle applicaties met owners en aantal gekoppelde processen' },
      { id: 'koppelingen',label: 'Koppelingen', description: 'Overzicht van alle proces–applicatie-koppelingen' },
    ],
  },
]

const FORMATS: { id: Format; label: string; ext: string; icon: React.ReactNode; description: string; color: string; borderColor: string; bgActive: string }[] = [
  {
    id: 'xlsx',
    label: 'Excel',
    ext: '.xlsx',
    icon: <FileSpreadsheet size={20} />,
    description: 'Tabellen per sectie, ideaal voor analyse',
    color: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    bgActive: 'bg-emerald-50 border-emerald-500',
  },
  {
    id: 'docx',
    label: 'Word',
    ext: '.docx',
    icon: <FileText size={20} />,
    description: 'Opgemaakte rapportage met tabellen',
    color: 'text-blue-700',
    borderColor: 'border-blue-300',
    bgActive: 'bg-blue-50 border-blue-500',
  },
  {
    id: 'pptx',
    label: 'PowerPoint',
    ext: '.pptx',
    icon: <Presentation size={20} />,
    description: 'Presentatieslides per sectie',
    color: 'text-orange-700',
    borderColor: 'border-orange-300',
    bgActive: 'bg-orange-50 border-orange-500',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const [activeModuleId, setActiveModuleId] = useState<string>(MODULES[0].id)
  const [selectedSections, setSelectedSections] = useState<Record<string, Set<string>>>(
    Object.fromEntries(MODULES.map(m => [m.id, new Set(m.sections.map(s => s.id))]))
  )
  const [selectedFormat, setSelectedFormat] = useState<Format>('xlsx')

  const activeModule = MODULES.find(m => m.id === activeModuleId)!
  const activeSections = selectedSections[activeModuleId]

  function toggleSection(sectionId: string) {
    setSelectedSections(prev => {
      const next = new Set(prev[activeModuleId])
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return { ...prev, [activeModuleId]: next }
    })
  }

  function toggleAll() {
    const allIds = activeModule.sections.map(s => s.id)
    const allSelected = allIds.every(id => activeSections.has(id))
    setSelectedSections(prev => ({
      ...prev,
      [activeModuleId]: allSelected ? new Set() : new Set(allIds),
    }))
  }

  function handleExport() {
    const secs = Array.from(activeSections)
    if (secs.length === 0) return
    const url = `${API_BASE}/${activeModuleId}/${selectedFormat}?sections=${secs.join(',')}`
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const allSelected = activeModule.sections.every(s => activeSections.has(s.id))
  const noneSelected = activeSections.size === 0
  const activeFormatMeta = FORMATS.find(f => f.id === selectedFormat)!

  return (
    <div className="min-h-full">
      <PageHeader
        title="Export"
        subtitle="Exporteer gegevens per module naar Word, Excel of PowerPoint"
      />

      <div className="space-y-6 max-w-5xl">

        {/* ── Step 1: Module ── */}
        <section>
          <StepLabel step={1} label="Kies een module" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {MODULES.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveModuleId(m.id)}
                className={[
                  'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-all duration-150',
                  activeModuleId === m.id
                    ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className={activeModuleId === m.id ? 'text-brand-600' : 'text-gray-400'}>
                  {m.icon}
                </span>
                <span className="text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Step 2: Sections ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <StepLabel step={2} label={`Selecteer secties – ${activeModule.label}`} />
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors"
            >
              {allSelected ? <CheckSquare size={14} className="text-brand-500" /> : <Square size={14} />}
              <span>{allSelected ? 'Deselecteer alles' : 'Alles selecteren'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeModule.sections.map(section => {
              const checked = activeSections.has(section.id)
              return (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  className={[
                    'flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-150',
                    checked
                      ? 'bg-brand-50 border-brand-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className={['mt-0.5 shrink-0', checked ? 'text-brand-500' : 'text-gray-300'].join(' ')}>
                    {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                  <div>
                    <div className={['text-sm font-medium', checked ? 'text-brand-800' : 'text-gray-700'].join(' ')}>
                      {section.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {section.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Step 3: Format ── */}
        <section>
          <StepLabel step={3} label="Kies exportformaat" />
          <div className="grid grid-cols-3 gap-3 max-w-xl">
            {FORMATS.map(fmt => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id)}
                className={[
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-150',
                  selectedFormat === fmt.id
                    ? fmt.bgActive
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className={selectedFormat === fmt.id ? fmt.color : 'text-gray-400'}>
                  {fmt.icon}
                </span>
                <div className="text-center">
                  <div className={['text-sm font-semibold', selectedFormat === fmt.id ? fmt.color : 'text-gray-700'].join(' ')}>
                    {fmt.label}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{fmt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Export button ── */}
        <section>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              disabled={noneSelected}
              className={[
                'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
                noneSelected
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow',
              ].join(' ')}
            >
              <Download size={16} />
              Download {activeFormatMeta.label}
              <span className="font-normal opacity-75">{activeFormatMeta.ext}</span>
            </button>

            {noneSelected && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <ChevronRight size={12} />
                Selecteer minimaal één sectie om te exporteren
              </p>
            )}

            {!noneSelected && (
              <p className="text-xs text-gray-500">
                {activeSections.size} van {activeModule.sections.length} sectie{activeSections.size !== 1 ? 's' : ''} geselecteerd
              </p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold shrink-0">
        {step}
      </span>
      <h2 className="text-sm font-semibold text-gray-800">{label}</h2>
    </div>
  )
}
