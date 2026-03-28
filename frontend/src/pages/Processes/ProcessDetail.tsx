import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { processesApi } from '../../api/processes'
import { applicationsApi } from '../../api/applications'
import { biaApi } from '../../api/bia'
import { businessContextApi } from '../../api/businessContext'
import { BiaScoreSummary, BiaAlgemeenReadOnly } from '../Bia/biaShared'
import { BusinessContextReadOnly } from '../BusinessContext/businessContextShared'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { ScoreBadge } from '../../components/common/Badge'
import { FormField, Input, Textarea } from '../../components/common/FormField'
import { Pencil, Unlink, ArrowLeft, Plus, List, FilePlus } from 'lucide-react'
import type { Application } from '../../types'


const TABS = ['Overzicht', 'Applicaties', 'BIA & BIV-Classificatie', 'Procescontext'] as const
type ModalView = 'choice' | 'existing' | 'new'

export default function ProcessDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<typeof TABS[number]>('Overzicht')
  const [modal, setModal] = useState<ModalView | null>(null)
  const [appSearch, setAppSearch] = useState('')
  const [newApp, setNewApp] = useState<Partial<Application>>({ code: '', name: '', description: '', business_owner: '', technical_owner: '', notes: '' })

  const pid = Number(id)

  const { data: process, isLoading } = useQuery({
    queryKey: ['processes', pid],
    queryFn: () => processesApi.get(pid),
  })

  const { data: bia, isLoading: biaLoading } = useQuery({
    queryKey: ['bia', pid],
    queryFn: () => biaApi.get(pid),
    enabled: !!pid,
    retry: false,
  })

  const { data: businessContext, isLoading: bcLoading } = useQuery({
    queryKey: ['business-context', pid],
    queryFn: () => businessContextApi.get(pid),
    enabled: !!pid,
    retry: false,
  })

  const procesClassificatie =
    bia?.availability_score != null || bia?.integrity_score != null || bia?.confidentiality_score != null
      ? Math.min(bia.availability_score ?? 5, bia.integrity_score ?? 5, bia.confidentiality_score ?? 5)
      : undefined

  const { data: allApps = [] } = useQuery({
    queryKey: ['applications', appSearch],
    queryFn: () => applicationsApi.list({ search: appSearch || undefined }),
    enabled: modal === 'existing',
  })

  const { data: suggestedAppCode } = useQuery({
    queryKey: ['applications', 'next-code'],
    queryFn: applicationsApi.nextCode,
    enabled: modal === 'new',
    staleTime: 0,
  })

  // Pre-fill code when opening new-app view
  const setNewView = () => {
    setNewApp({ code: '', name: '', description: '', business_owner: '', technical_owner: '', notes: '' })
    setModal('new')
  }

  // Set suggested code into state as soon as it resolves
  useEffect(() => {
    if (suggestedAppCode && !newApp.code) {
      setNewApp(f => ({ ...f, code: suggestedAppCode }))
    }
  }, [suggestedAppCode])

  const closeModal = () => { setModal(null); setAppSearch('') }

  const linkMutation = useMutation({
    mutationFn: (appId: number) => processesApi.linkApp(pid, appId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['processes', pid] }); closeModal() },
  })

  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      const created = await applicationsApi.create({ ...newApp })
      await processesApi.linkApp(pid, created.id)
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processes', pid] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      closeModal()
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (appId: number) => processesApi.unlinkApp(pid, appId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['processes', pid] }),
  })

  if (isLoading) return <p className="text-gray-400 p-8">Laden...</p>
  if (!process) return <p className="text-red-500 p-8">Proces niet gevonden.</p>

  const setNew = (k: keyof Application, v: string) => setNewApp(f => ({ ...f, [k]: v }))

  return (
    <div>
      <PageHeader
        title={process.name}
        subtitle={process.code}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/processes')}><ArrowLeft size={15} /> Terug</Button>
            <Button variant="secondary" onClick={() => navigate(`/processes/${pid}/edit`)}><Pencil size={15} /> Bewerken</Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overzicht */}
      {tab === 'Overzicht' && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <Field label="Eigenaar" value={process.owner} />
            <Field label="Afdeling" value={process.department} />
            <Field label="Procesclassificatie"><ScoreBadge score={procesClassificatie} /></Field>
            <Field label="Laatst gewijzigd" value={process.last_assessment_date} />
            <Field label="Beschrijving" value={process.description} full />
            <Field label="Doelstelling" value={process.objective} full />
            {process.is_critical && <Field label="Reden kritisch" value={process.critical_reason} full />}
            <Field label="Notities" value={process.notes} full />
          </div>
        </Card>
      )}

      {/* Applicaties */}
      {tab === 'Applicaties' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-800">Gekoppelde applicaties ({process.applications.length})</h2>
            <Button size="sm" onClick={() => setModal('choice')}>
              <Plus size={14} /> Toevoegen
            </Button>
          </div>
          {process.applications.length === 0 ? (
            <p className="text-gray-400 text-sm py-4">Nog geen applicaties gekoppeld.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {process.applications.map(a => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium text-sm">{a.name}</span>
                    <span className="ml-2 font-mono text-xs text-gray-400">{a.code}</span>
                  </div>
                  <button onClick={() => unlinkMutation.mutate(a.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                    <Unlink size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* BIA & BIV-Classificatie */}
      {tab === 'BIA & BIV-Classificatie' && (
        biaLoading ? (
          <Card><p className="text-sm text-gray-400 text-center py-8">Laden…</p></Card>
        ) : !bia ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">Nog geen BIA ingevuld voor dit proces.</p>
              <Button onClick={() => navigate(`/bia/${pid}`)}>BIA invullen</Button>
            </div>
          </Card>
        ) : (
          <>
            <BiaScoreSummary
              availabilityScore={bia.availability_score}
              integrityScore={bia.integrity_score}
              confidentialityScore={bia.confidentiality_score}
            />
            <BiaAlgemeenReadOnly bia={bia} />
          </>
        )
      )}

      {/* Procescontext */}
      {tab === 'Procescontext' && (
        bcLoading ? (
          <Card><p className="text-sm text-gray-400 text-center py-8">Laden…</p></Card>
        ) : !businessContext ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">Nog geen procescontext ingevuld.</p>
              <Button onClick={() => navigate(`/business-context/${pid}`)}>Procescontext invullen</Button>
            </div>
          </Card>
        ) : (
          <BusinessContextReadOnly bc={businessContext} />
        )
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Choice view */}
            {modal === 'choice' && (
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Applicatie toevoegen</h3>
                <p className="text-sm text-gray-500 mb-5">Kies een optie:</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setModal('existing')}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
                  >
                    <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                      <List size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">Bestaande applicatie koppelen</div>
                      <div className="text-xs text-gray-500 mt-0.5">Kies uit al geregistreerde applicaties</div>
                    </div>
                  </button>
                  <button
                    onClick={setNewView}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
                  >
                    <div className="p-2 bg-green-50 rounded-lg shrink-0">
                      <FilePlus size={18} className="text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">Nieuwe applicatie toevoegen</div>
                      <div className="text-xs text-gray-500 mt-0.5">Aanmaken en direct koppelen aan dit proces</div>
                    </div>
                  </button>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button variant="secondary" size="sm" onClick={closeModal}>Annuleren</Button>
                </div>
              </div>
            )}

            {/* Existing view */}
            {modal === 'existing' && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setModal('choice')} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="font-semibold text-gray-900">Bestaande applicatie koppelen</h3>
                </div>
                <input
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Zoek op naam of code..."
                  value={appSearch}
                  onChange={e => setAppSearch(e.target.value)}
                />
                <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg mb-4">
                  {allApps.filter(a => !process.applications.find(pa => pa.id === a.id)).length === 0 ? (
                    <li className="px-4 py-6 text-sm text-gray-400 text-center">Geen applicaties gevonden.</li>
                  ) : (
                    allApps
                      .filter(a => !process.applications.find(pa => pa.id === a.id))
                      .map(a => (
                        <li key={a.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50">
                          <div>
                            <span className="text-sm font-medium text-gray-800">{a.name}</span>
                            <span className="ml-2 font-mono text-xs text-gray-400">{a.code}</span>
                          </div>
                          <Button size="sm" onClick={() => linkMutation.mutate(a.id)} loading={linkMutation.isPending}>
                            Koppelen
                          </Button>
                        </li>
                      ))
                  )}
                </ul>
                <Button variant="secondary" size="sm" onClick={closeModal}>Annuleren</Button>
              </div>
            )}

            {/* New application view */}
            {modal === 'new' && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setModal('choice')} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="font-semibold text-gray-900">Nieuwe applicatie toevoegen</h3>
                </div>

                {createAndLinkMutation.isError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {(createAndLinkMutation.error as Error).message}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <FormField label="Applicatiecode" required>
                    <Input
                      value={newApp.code ?? ''}
                      onChange={e => setNew('code', e.target.value)}
                      placeholder="KAPP-001"
                    />
                  </FormField>
                  <FormField label="Naam" required>
                    <Input
                      autoFocus
                      value={newApp.name ?? ''}
                      onChange={e => setNew('name', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Functioneel eigenaar">
                    <Input value={newApp.business_owner ?? ''} onChange={e => setNew('business_owner', e.target.value)} />
                  </FormField>
                  <FormField label="Technisch eigenaar">
                    <Input value={newApp.technical_owner ?? ''} onChange={e => setNew('technical_owner', e.target.value)} />
                  </FormField>
                  <FormField label="Beschrijving" className="col-span-2">
                    <Textarea value={newApp.description ?? ''} onChange={e => setNew('description', e.target.value)} rows={2} />
                  </FormField>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={closeModal}>Annuleren</Button>
                  <Button
                    size="sm"
                    onClick={() => createAndLinkMutation.mutate()}
                    loading={createAndLinkMutation.isPending}
                    disabled={!newApp.code || !newApp.name}
                  >
                    Aanmaken en koppelen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, full, children }: { label: string; value?: string | null; full?: boolean; children?: React.ReactNode }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-gray-800">{children ?? (value || <span className="text-gray-300">—</span>)}</dd>
    </div>
  )
}
