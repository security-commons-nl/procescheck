import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { applicationsApi } from '../../api/applications'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { Input } from '../../components/common/FormField'
import { Plus, Trash2 } from 'lucide-react'

export default function ApplicationList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['applications', search],
    queryFn: () => applicationsApi.list({ search: search || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => applicationsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); setDeleteId(null) },
  })

  return (
    <div>
      <PageHeader
        title="Applicaties"
        subtitle={`${data.length} applicaties`}
        actions={
          <Button onClick={() => navigate('/applications/new')}>
            <Plus size={16} /> Nieuwe applicatie
          </Button>
        }
      />
      <Card>
        <div className="mb-4">
          <Input placeholder="Zoek op naam of code..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>
        {isLoading ? (
          <p className="text-ink-subtle text-sm py-8 text-center">Laden...</p>
        ) : data.length === 0 ? (
          <p className="text-ink-subtle text-sm py-8 text-center">Geen applicaties gevonden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Code</th>
                <th className="pb-2 pr-4 font-medium">Naam</th>
                <th className="pb-2 pr-4 font-medium">Functioneel eigenaar</th>
                <th className="pb-2 pr-4 font-medium">Technisch eigenaar</th>
                <th className="pb-2 pr-4 font-medium">Gekoppelde processen</th>
                <th className="pb-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {data.map(a => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/applications/${a.id}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">{a.code}</td>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">{a.name}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{a.business_owner ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{a.technical_owner ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{a.processes?.length ?? 0}</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteId(a.id) }}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <ConfirmDialog
        open={deleteId !== null}
        title="Applicatie verwijderen"
        message="Weet je zeker dat je deze applicatie wilt verwijderen? Koppelingen met processen worden ook verwijderd."
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
