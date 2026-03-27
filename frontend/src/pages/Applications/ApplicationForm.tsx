import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '../../api/applications'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { FormField, Input, Textarea } from '../../components/common/FormField'
import type { Application } from '../../types'

export default function ApplicationForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: existing } = useQuery({
    queryKey: ['applications', Number(id)],
    queryFn: () => applicationsApi.get(Number(id)),
    enabled: isEdit,
  })

  const { data: suggestedCode } = useQuery({
    queryKey: ['applications', 'next-code'],
    queryFn: applicationsApi.nextCode,
    enabled: !isEdit,
    staleTime: 0,
  })

  const [form, setForm] = useState<Partial<Application>>({ code: '', name: '' })

  useEffect(() => { if (existing) setForm(existing) }, [existing])

  useEffect(() => {
    if (!isEdit && suggestedCode && !form.code) {
      setForm(f => ({ ...f, code: suggestedCode }))
    }
  }, [suggestedCode])

  const set = (k: keyof Application, v: string) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => isEdit ? applicationsApi.update(Number(id), form) : applicationsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); navigate('/applications') },
  })

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Applicatie bewerken' : 'Nieuwe applicatie'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>Annuleren</Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Opslaan</Button>
          </>
        }
      />
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Applicatiecode" required>
            <Input value={form.code ?? ''} onChange={e => set('code', e.target.value)} placeholder="KAPP-001" />
          </FormField>
          <FormField label="Applicatienaam" required>
            <Input value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </FormField>
          <FormField label="Functioneel eigenaar">
            <Input value={form.business_owner ?? ''} onChange={e => set('business_owner', e.target.value)} />
          </FormField>
          <FormField label="Technisch eigenaar">
            <Input value={form.technical_owner ?? ''} onChange={e => set('technical_owner', e.target.value)} />
          </FormField>
          <FormField label="Beschrijving" className="md:col-span-2">
            <Textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </FormField>
          <FormField label="Notities" className="md:col-span-2">
            <Textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2} />
          </FormField>
        </div>
      </Card>
    </div>
  )
}
