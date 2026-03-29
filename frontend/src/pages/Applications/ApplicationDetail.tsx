import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '../../api/applications'
import { processesApi } from '../../api/processes'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Input } from '../../components/common/FormField'
import { ArrowLeft, Pencil, GitBranch, Plus, X } from 'lucide-react'

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const aid = Number(id)

  const [showModal, setShowModal] = useState(false)
  const [processSearch, setProcessSearch] = useState('')
  const [reviewDate, setReviewDate] = useState('')

  const { data: app, isLoading } = useQuery({
    queryKey: ['applications', aid],
    queryFn: () => applicationsApi.get(aid),
  })

  useEffect(() => { setReviewDate(app?.review_date ?? '') }, [app?.review_date])

  const { data: allProcesses = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: () => processesApi.list(),
    enabled: showModal,
  })

  const linkMutation = useMutation({
    mutationFn: (processId: number) => processesApi.linkApp(processId, aid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications', aid] }) },
  })

  const reviewMutation = useMutation({
    mutationFn: (val: string) => applicationsApi.update(aid, { review_date: val || null } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications', aid] }) },
  })

  if (isLoading) return <p className="text-gray-400 p-8">Laden...</p>
  if (!app) return <p className="text-red-500 p-8">Applicatie niet gevonden.</p>

  return (
    <div>
      <PageHeader
        title={app.name}
        subtitle={app.code}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/applications')}><ArrowLeft size={15} /> Terug</Button>
            <Button variant="secondary" onClick={() => navigate(`/applications/${aid}/edit`)}><Pencil size={15} /> Bewerken</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Details */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Gegevens</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <Field label="Applicatiecode" value={app.code} />
              <Field label="Applicatienaam" value={app.name} />
              <Field label="Functioneel eigenaar" value={app.business_owner} />
              <Field label="Technisch eigenaar" value={app.technical_owner} />
              {(() => {
                const cutoff = new Date()
                cutoff.setFullYear(cutoff.getFullYear() - 1)
                const rd = reviewDate ? new Date(reviewDate) : null
                const isExpired = rd !== null && rd < cutoff
                return (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Laatste review datum</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={reviewDate}
                        onChange={e => {
                          setReviewDate(e.target.value)
                          reviewMutation.mutate(e.target.value)
                        }}
                        className={[
                          'h-8 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent',
                          isExpired
                            ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-300'
                            : 'border-gray-300 bg-white text-gray-800 focus:ring-brand-500',
                        ].join(' ')}
                      />
                      {isExpired && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          Review verlopen
                        </span>
                      )}
                    </dd>
                  </div>
                )
              })()}
              <Field label="Beschrijving" value={app.description} full />
              <Field label="Notities" value={app.notes} full />
            </div>
          </Card>
        </div>

        {/* Gekoppelde processen */}
        <div>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Gekoppelde processen ({app.processes?.length ?? 0})
              </h2>
              <button
                onClick={() => { setProcessSearch(''); setShowModal(true) }}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <Plus size={13} /> Toevoegen
              </button>
            </div>
            {!app.processes?.length ? (
              <p className="text-sm text-gray-400">Niet gekoppeld aan een proces.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {app.processes.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/processes/${p.id}`)}
                      className="w-full flex items-center gap-3 py-2.5 text-left hover:text-brand-600 transition-colors group"
                    >
                      <GitBranch size={14} className="text-gray-300 group-hover:text-brand-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-800 group-hover:text-brand-600">{p.name}</div>
                        <div className="font-mono text-xs text-gray-400">{p.code}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Link process modal */}
      {showModal && (() => {
        const linkedIds = new Set((app.processes ?? []).map(p => p.id))
        const filtered = allProcesses.filter(p =>
          !linkedIds.has(p.id) &&
          (p.name.toLowerCase().includes(processSearch.toLowerCase()) ||
           p.code.toLowerCase().includes(processSearch.toLowerCase()))
        )
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Proces koppelen</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-gray-100">
                <Input
                  placeholder="Zoek op naam of code..."
                  value={processSearch}
                  onChange={e => setProcessSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <li className="px-5 py-6 text-sm text-gray-400 text-center">Geen processen gevonden.</li>
                ) : filtered.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => { linkMutation.mutate(p.id); setShowModal(false) }}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"
                    >
                      <GitBranch size={14} className="text-gray-300 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{p.name}</div>
                        <div className="font-mono text-xs text-gray-400">{p.code}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-gray-800 text-sm">{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  )
}
