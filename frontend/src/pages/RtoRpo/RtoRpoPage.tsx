import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { processesApi } from '../../api/processes'
import { rtoRpoApi } from '../../api/rtoRpo'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { FormField, Input, Select, Textarea } from '../../components/common/FormField'
import type { RtoRpo } from '../../types'

const UNITS = ['minuten', 'uren', 'dagen', 'weken', 'maanden']

export default function RtoRpoPage() {
  const { processId } = useParams<{ processId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedPid, setSelectedPid] = useState<number | undefined>(
    processId ? Number(processId) : undefined,
  )
  const [form, setForm] = useState<Partial<RtoRpo>>({})

  const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => processesApi.list() })
  const pid = selectedPid

  const { data: existing } = useQuery({
    queryKey: ['rto-rpo', pid],
    queryFn: () => rtoRpoApi.get(pid!),
    enabled: !!pid,
    retry: false,
  })

  const current: Partial<RtoRpo> = existing ? { ...existing, ...form } : form

  const mutation = useMutation({
    mutationFn: () => rtoRpoApi.upsert(pid!, current),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rto-rpo', pid] })
      qc.invalidateQueries({ queryKey: ['processes'] })
      setForm({})
    },
  })

  const set = (k: keyof RtoRpo, v: string | number | undefined) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processen</div>
          <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
            {processes.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => { setSelectedPid(p.id); setForm({}); navigate(`/rto-rpo/${p.id}`) }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    pid === p.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-1">
                    <span>{p.code}</span>
                    {p.has_rto_rpo && <span className="text-green-500">✓</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <PageHeader
          title="RTO / RPO"
          subtitle={pid ? processes.find(p => p.id === pid)?.name : 'Selecteer een proces'}
          actions={
            pid ? (
              <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Opslaan</Button>
            ) : undefined
          }
        />

        {!pid && (
          <div className="bg-white border border-gray-200 rounded-xl text-center py-12 text-gray-400">
            Selecteer een proces aan de linkerkant.
          </div>
        )}

        {pid && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="RTO waarde">
                <Input
                  type="number"
                  min={0}
                  value={current.rto_value ?? ''}
                  onChange={e => set('rto_value', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="bijv. 4"
                />
              </FormField>
              <FormField label="RTO eenheid">
                <Select
                  value={current.rto_unit ?? ''}
                  onChange={e => set('rto_unit', e.target.value || undefined)}
                >
                  <option value="">— Selecteer —</option>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </FormField>
              <FormField label="RPO waarde">
                <Input
                  type="number"
                  min={0}
                  value={current.rpo_value ?? ''}
                  onChange={e => set('rpo_value', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="bijv. 2"
                />
              </FormField>
              <FormField label="RPO eenheid">
                <Select
                  value={current.rpo_unit ?? ''}
                  onChange={e => set('rpo_unit', e.target.value || undefined)}
                >
                  <option value="">— Selecteer —</option>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </FormField>
              <FormField label="Toelichting" className="md:col-span-2">
                <Textarea
                  rows={4}
                  value={current.explanation ?? ''}
                  onChange={e => set('explanation', e.target.value || undefined)}
                  placeholder="Optionele toelichting op de RTO/RPO waarden..."
                />
              </FormField>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
