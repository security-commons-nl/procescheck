import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '../../api/applications'
import { apiErrorMessage } from '../../api/client'
import { isReviewExpired } from '../../utils/review'
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
    refetchOnMount: 'always',
  })

  const [form, setForm] = useState<Partial<Application>>({ code: '', name: '' })
  const [codeTouched, setCodeTouched] = useState(false)

  useEffect(() => { if (existing) setForm(existing) }, [existing])

  // Pre-fill auto-generated code zolang de gebruiker het veld niet zelf aanpaste
  useEffect(() => {
    if (!isEdit && suggestedCode && !codeTouched) {
      setForm(f => ({ ...f, code: suggestedCode }))
    }
  }, [suggestedCode, isEdit, codeTouched])

  const set = (k: keyof Application, v: string) => setForm(f => ({ ...f, [k]: v }))

  const canSave = Boolean(form.code?.trim() && form.name?.trim())

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
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!canSave}>Opslaan</Button>
          </>
        }
      />
      {mutation.isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {apiErrorMessage(mutation.error)}
        </div>
      )}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Applicatiecode" required>
            <Input value={form.code ?? ''} onChange={e => { setCodeTouched(true); set('code', e.target.value) }} placeholder="KAPP-001" />
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
          <FormField label="Laatste review datum">
            {(() => {
              const isExpired = isReviewExpired(form.review_date)
              return (
                <>
                  <input
                    type="date"
                    value={form.review_date ?? ''}
                    onChange={e => set('review_date', e.target.value)}
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
