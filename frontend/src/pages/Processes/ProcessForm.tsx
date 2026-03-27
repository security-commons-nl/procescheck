import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { processesApi } from '../../api/processes'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { FormField, Input, Textarea, Select } from '../../components/common/FormField'
import type { Process } from '../../types'

export default function ProcessForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const isEdit = !!id

  // Fetch existing process when editing
  const { data: existing } = useQuery({
    queryKey: ['processes', Number(id)],
    queryFn: () => processesApi.get(Number(id)),
    enabled: isEdit,
  })

  // Fetch next available code for new processes
  const { data: suggestedCode } = useQuery({
    queryKey: ['processes', 'next-code'],
    queryFn: processesApi.nextCode,
    enabled: !isEdit,
  })

  const [form, setForm] = useState<Partial<Process>>({
    code: '',
    name: '',
    description: '',
    objective: '',
    owner: '',
    department: '',
    is_critical: true,
    critical_reason: '',
    notes: '',
  })

  // Pre-fill auto-generated code for new process
  useEffect(() => {
    if (!isEdit && suggestedCode && !form.code) {
      setForm(f => ({ ...f, code: suggestedCode }))
    }
  }, [suggestedCode, isEdit])

  // Load existing data when editing
  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  const set = (k: keyof Process, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? processesApi.update(Number(id), form)
      : processesApi.create(form),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['processes'] })
      navigate(`/processes/${p.id}`)
    },
  })

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Proces bewerken' : 'Nieuw proces'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>Annuleren</Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Opslaan</Button>
          </>
        }
      />

      {mutation.isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(mutation.error as Error).message}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Procescode" required>
            <Input
              value={form.code ?? ''}
              onChange={e => set('code', e.target.value)}
              placeholder="b.v. KP-001"
            />
          </FormField>
          <FormField label="Procesnaam" required>
            <Input value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </FormField>
          <FormField label="Eigenaar">
            <Input value={form.owner ?? ''} onChange={e => set('owner', e.target.value)} />
          </FormField>
          <FormField label="Afdeling / Domein / Cluster">
            <Input value={form.department ?? ''} onChange={e => set('department', e.target.value)} />
          </FormField>
          <FormField label="Kritisch proces">
            <Select
              value={form.is_critical ? 'true' : 'false'}
              onChange={e => set('is_critical', e.target.value === 'true')}
            >
              <option value="true">Ja</option>
              <option value="false">Nee</option>
            </Select>
          </FormField>
          <FormField label="Laatste beoordelingsdatum">
            <div className="flex items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
              {isEdit && existing?.last_assessment_date
                ? new Date(existing.last_assessment_date).toLocaleDateString('nl-NL')
                : 'Wordt automatisch ingesteld bij opslaan'}
            </div>
          </FormField>
          <FormField label="Beschrijving" className="md:col-span-2">
            <Textarea
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              rows={3}
            />
          </FormField>
          <FormField label="Doelstelling" className="md:col-span-2">
            <Textarea
              value={form.objective ?? ''}
              onChange={e => set('objective', e.target.value)}
              rows={3}
            />
          </FormField>
          {form.is_critical && (
            <FormField label="Reden / motivatie kritisch" className="md:col-span-2">
              <Textarea
                value={form.critical_reason ?? ''}
                onChange={e => set('critical_reason', e.target.value)}
                rows={3}
              />
            </FormField>
          )}
          <FormField label="Notities" className="md:col-span-2">
            <Textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              rows={2}
            />
          </FormField>
        </div>
      </Card>
    </div>
  )
}
